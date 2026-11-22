import type { Editor } from '@tiptap/core';
import { createEditor, tableValue, type TableValue } from './editor';
import { TableControls } from './controls';
import './editor.css';
import { clipboardMessages } from './clipboard';
import { cellEditorStates, type BlockOptions, type CellEditors } from './hybrid';

type State = TableValue | null | string;
type Options = { attributes?: Record<string, string> };
type Strings = Record<string, string>;

declare global {
  interface Window {
    telepath: { register(name: string, constructor: unknown): void };
  }
}

const instances = new WeakMap<HTMLElement, BoundTable>();

class BoundTable {
  readonly input: HTMLInputElement;
  readonly idForLabel: string;
  editor?: Editor;
  private state: State;
  private observer: MutationObserver;
  private events = new AbortController();
  private message: HTMLElement;
  private controls: TableControls;
  private surface: HTMLElement;
  private status: HTMLElement;
  private cellEditors: CellEditors;

  constructor(
    readonly root: HTMLElement,
    state: State,
    id: string,
    private strings: Strings,
    private options: Options = {},
    private block?: BlockOptions | null,
  ) {
    this.input = root.querySelector('input')!;
    this.surface = root.querySelector('[data-table-editor]')!;
    this.status = document.createElement('p');
    this.status.className = 'help';
    this.status.dataset.tableStatus = '';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-atomic', 'true');
    this.surface.after(this.status);
    this.message = root.querySelector('[data-table-error]')!;
    this.message.id = `${id}-table-error`;
    this.idForLabel = `${id}-editor`;
    this.state = state;
    this.cellEditors = { cells: new Set(), prefix: this.input.name, counter: 0 };

    const closeCell = (event: Event) => {
      const active = this.cellEditors.active;
      if (active && !active.dom.contains(event.target as Node)) active.close(false);
    };
    // Finish before toolbar actions or another pencil runs. Body-mounted native
    // choosers and insertion popovers are outside this root and remain local.
    root.addEventListener('click', closeCell, { capture: true, signal: this.events.signal });
    root.addEventListener('focusin', event => {
      if ((event.target as Element).closest('[data-table-toolbar], [data-table-metadata]')) closeCell(event);
    }, { signal: this.events.signal });
    root.addEventListener('mouseup', event => {
      // Let ProseMirror finish its document-level mouse handlers before hiding
      // the expanded editor changes the table's geometry.
      const active = this.cellEditors.active;
      if (active && !active.dom.contains(event.target as Node)) queueMicrotask(() => {
        if (this.cellEditors.active === active) active.close(false);
      });
    }, { signal: this.events.signal });

    this.controls = new TableControls(root, id, this.events.signal, () => this.synchronize(), block, () => { this.getValue(); });

    this.setState(state);
    root.closest('form')?.addEventListener('submit', () => this.getValue(), { capture: true, signal: this.events.signal });
    // Wagtail retains deleted blocks in the form as hidden children. Observe
    // wrapper deletion flags as well as DOM removal, including deleted parents.
    // Collapsed panels remain live; reordering is evaluated after DOM mutations.
    this.observer = new MutationObserver(() => {
      const deleted = root.closest('[data-streamfield-child][aria-hidden="true"]');
      if (!root.isConnected || deleted) this.destroy();
    });
    this.observer.observe(root.closest('form') ?? document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden'],
    });
    instances.set(root, this);
  }

  setState(state: State) {
    this.status.textContent = '';
    this.state = state;
    this.input.value = typeof state === 'string' ? state : '';
    if (typeof state === 'string') {
      this.editor?.destroy();
      this.editor = undefined;
      this.controls.refresh();
      this.message.textContent = this.strings.invalid;
      this.message.hidden = false;
      return;
    }
    if (this.editor) {
      this.editor.commands.setContent(
        state ? { type: 'doc', content: [state.table] } : { type: 'doc', content: [] },
        { emitUpdate: false },
      );
    } else {
      this.editor = createEditor(this.surface, state, messages => {
        this.status.textContent = messages.map(key => this.strings[key] ?? clipboardMessages[key]).join(' ');
      }, this.block ? { block: this.block, editors: this.cellEditors } : undefined);
      this.editor.on('update', ({ transaction }) => this.synchronize(!transaction.getMeta('hybridInitialization')));
      this.editor.on('transaction', () => {
        this.controls.refresh(this.editor);
        for (const cell of this.cellEditors.cells) cell.label();
      });
      const dom = this.editor.view.dom;
      dom.id = this.idForLabel;
      dom.setAttribute('aria-label', this.strings.editor);
      dom.setAttribute('aria-multiline', 'true');
      dom.addEventListener('keydown', event => {
        if ((event.target as HTMLElement).closest('[data-wagtail-cell]')) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          this.controls.focus();
        }
      }, { signal: this.events.signal });
      dom.setAttribute('aria-describedby', [
        this.options.attributes?.['aria-describedby'], this.message.id,
      ].filter(Boolean).join(' '));
    }
    this.message.hidden = true;
    this.controls.setMetadata(state);
    this.controls.refresh(this.editor);
    this.writeValue();
  }

  private writeValue() {
    if (!this.editor) return;
    const doc = this.block ? cellEditorStates(this.editor, this.cellEditors, false) : this.editor.getJSON();
    const value = tableValue(doc, { caption: this.controls.caption.value, description: this.controls.description.value });
    this.state = value;
    this.input.value = JSON.stringify(value);
  }

  private synchronize(notify = true) {
    const doc = this.block ? cellEditorStates(this.editor!, this.cellEditors, false) : this.editor!.getJSON();
    try {
      this.state = tableValue(doc, {
        caption: this.controls.caption.value,
        description: this.controls.description.value,
      });
      this.input.value = JSON.stringify(this.state);
      this.message.hidden = true;
    } catch {
      // Preserve the full unsupported document in the POST and duplicated state.
      // Server validation will reject it; the live editor retains all content.
      this.input.value = JSON.stringify({ version: 1, document: doc });
      this.message.textContent = this.strings.unsupported;
      this.message.hidden = false;
    }
    this.controls.refresh(this.editor);
    if (notify) this.input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  getValue() {
    for (const cell of [...this.cellEditors.cells]) cell.flush();
    if (this.message.hidden) this.writeValue();
    return this.input.value;
  }

  getState(): State {
    // Invalid documents remain raw values, rather than duplicating stale content.
    if (!this.message.hidden) return this.input.value;
    if (this.block && this.editor) {
      this.getValue();
      return tableValue(cellEditorStates(this.editor, this.cellEditors, true), {
        caption: this.controls.caption.value, description: this.controls.description.value,
      });
    }
    return structuredClone(this.state);
  }

  focus() {
    if (this.editor) this.editor.commands.focus();
    else {
      this.message.tabIndex = -1;
      this.message.focus();
    }
  }

  setInvalid(invalid: boolean) {
    this.editor?.view.dom.setAttribute('aria-invalid', String(invalid));
  }

  destroy() {
    this.controls.destroy();
    this.editor?.destroy();
    this.events.abort();
    this.observer.disconnect();
    instances.delete(this.root);
  }
}

class TableInput {
  constructor(private html: string, private strings: Strings, private block?: BlockOptions | null) {}

  render(
    placeholder: HTMLElement, name: string, id: string, state: State,
    _capabilities?: unknown, options?: Options,
  ) {
    const template = document.createElement('template');
    // Telepath provides the trusted widget template. Set names/IDs as properties
    // rather than interpolating form prefixes into HTML.
    template.innerHTML = this.html;
    const root = template.content.firstElementChild as HTMLElement;
    const input = root.querySelector('input')!;
    input.name = name;
    input.id = id;
    placeholder.replaceWith(root);
    return new BoundTable(root, state ?? null, id, this.strings, options, this.block);
  }

  getByName(name: string, container: HTMLElement) {
    const input = container instanceof HTMLInputElement && container.name === name
      ? container
      : [...container.querySelectorAll<HTMLInputElement>('input')]
        .find(element => element.name === name);
    const root = input?.closest<HTMLElement>('[data-wagtail-table]');
    const instance = root && instances.get(root);
    if (!instance) {
      const error = new Error(`Table widget ${name} was not found.`);
      error.name = 'InputNotFoundError';
      throw error;
    }
    return instance;
  }
}

window.telepath.register('wagtail_table.TableInput', TableInput);
