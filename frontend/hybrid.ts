import { Node as TiptapNode, type Editor, type JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode, Fragment } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { QuietCell } from './quiet';

interface BoundBlock {
  getValue(): unknown;
  getState(): unknown;
  setState(state: unknown): void;
  getDuplicatedState?(): unknown;
}

interface DraftailInput extends HTMLInputElement {
  draftailEditor?: { saveState(): void };
}

export interface BlockOptions {
  definition: { render(element: HTMLElement, prefix: string, state: unknown): BoundBlock };
  defaultValue: unknown;
  defaultState: unknown;
  errorMessage?: string;
  defaultQuiet?: string | null;
  quietUrl?: string;
  quietDefinition?: string;
  editLabel?: string;
  doneLabel?: string;
  quietLoading?: string;
}

interface LiveCell {
  position(): number | undefined;
  prefix: string;
  flush(): void;
  state(): unknown;
  label(): void;
}

interface InserterPopover {
  popper: HTMLElement;
  setProps(options: { appendTo: HTMLElement }): void;
  destroy(): void;
  hide(): void;
  state: { isDestroyed: boolean };
}

export interface CellEditors {
  cells: Set<LiveCell>;
  prefix: string;
  counter: number;
  active?: QuietCell;
}

declare global {
  interface Window {
    $: (element: HTMLElement) => {
      on(events: string, callback: () => void): void;
      off(events: string, callback: () => void): void;
    };
  }
}

export function containsBlock(content: ProseMirrorNode | Fragment): boolean {
  let found = false;
  content.descendants(node => {
    if (node.type.name === 'wagtailBlock') found = true;
    return !found;
  });
  return found;
}

function selectedCells(state: EditorState) {
  const cells: { node: ProseMirrorNode; pos: number }[] = [];
  const { selection } = state;
  if (selection instanceof CellSelection) {
    selection.forEachCell((node, pos) => cells.push({ node, pos }));
    return cells;
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (['cell', 'header_cell'].includes(node.type.spec.tableRole ?? '')) {
      cells.push({ node, pos: $from.before(depth) });
      break;
    }
  }
  return cells;
}

export function canChangeCell(editor: Pick<Editor, 'state'>, mode: string): boolean {
  return selectedCells(editor.state).some(({ node }) =>
    (node.firstChild?.type.name === 'wagtailBlock') !== (mode === 'block'));
}

export function cellTypeChange(state: EditorState, mode: string, options: BlockOptions) {
  const cells = selectedCells(state).filter(({ node }) =>
    (node.firstChild?.type.name === 'wagtailBlock') !== (mode === 'block'));
  if (!cells.length) return null;
  const destructive = cells.some(({ node }) => {
    if (node.firstChild?.type.name === 'wagtailBlock') {
      const value = node.firstChild.attrs.value;
      return !(value === null || value === '' || (Array.isArray(value) && value.length === 0));
    }
    return node.content.content.some(child => child.type.name !== 'paragraph' || child.childCount > 0);
  });
  const transaction = state.tr;
  // Work backwards so replacements cannot change the remaining cell positions.
  for (const { node, pos } of cells.sort((a, b) => b.pos - a.pos)) {
    const content = mode === 'block'
      ? state.schema.nodes.wagtailBlock.create({
        value: structuredClone(options.defaultValue), state: structuredClone(options.defaultState),
      })
      : state.schema.nodes.paragraph.create();
    transaction.replaceWith(pos + 1, pos + node.nodeSize - 1, content);
  }
  return { transaction, destructive };
}

export function changeCell(editor: Editor, mode: string, options: BlockOptions, confirm: () => boolean): boolean {
  const change = cellTypeChange(editor.state, mode, options);
  if (!change || (change.destructive && !confirm())) return false;
  editor.view.dispatch(change.transaction);
  editor.commands.focus();
  return true;
}

export function blockCellExtension(options: BlockOptions, owners: CellEditors) {
  return TiptapNode.create({
    name: 'wagtailBlock',
    group: 'block',
    atom: true,
    selectable: false,
    isolating: true,
    draggable: false,
    addAttributes() { return { value: { default: null }, state: { default: null }, quiet: { default: null } }; },
    // Never import a Wagtail block from external HTML or clipboard attributes.
    parseHTML() { return []; },
    renderHTML() { return ['div', { 'data-wagtail-cell': '' }, 'Wagtail content']; },
    addNodeView() {
      return ({ node, editor, getPos }) => {
        let current = node;
        let changing = false;
        let interacted = false;
        const dom = document.createElement('div');
        dom.className = 'wagtail-table-block-cell';
        dom.dataset.wagtailCell = '';
        // Position-based cells do not have stable Wagtail comment paths.
        dom.dataset.contentpathDisabled = '';
        dom.contentEditable = 'false';
        const mount = document.createElement('div');
        mount.dataset.cellFields = '';
        const placeholder = document.createElement('div');
        mount.append(placeholder);
        dom.append(mount);
        // Wagtail widgets resolve their IDs via document.getElementById during
        // render. Mount first; ProseMirror moves this same DOM into the cell.
        (editor.options.element as HTMLElement).append(dom);
        const prefix = `${owners.prefix}-cell-${owners.counter++}`;
        let bound: BoundBlock;
        try {
          // Wagtail replaces its placeholder. Retain our own wrapper so quiet
          // mode hides the complete native editor rather than a detached node.
          bound = options.definition.render(placeholder, prefix, node.attrs.state ?? options.defaultState);
        } catch (error) {
          console.error(error);
          const warning = document.createElement('p');
          warning.setAttribute('role', 'alert');
          warning.textContent = options.errorMessage ?? 'This block editor could not be loaded. Its content has been retained.';
          dom.replaceChildren(warning);
          return { dom, stopEvent: () => true, ignoreMutation: () => true };
        }
        let previous = JSON.stringify(bound.getValue());
        const popovers = new Set<InserterPopover>();
        const portalInserters = () => {
          for (const button of dom.querySelectorAll<HTMLElement & { _tippy?: InserterPopover }>('.c-sf-add-button')) {
            if (button._tippy && !popovers.has(button._tippy)) {
              // Native StreamBlock pickers otherwise get clipped by the table's
              // scrolling wrapper. Keep Tippy's own positioning and behavior.
              button._tippy.popper.id = `${prefix}-picker-${popovers.size}`;
              button._tippy.setProps({ appendTo: document.body });
              popovers.add(button._tippy);
            }
          }
        };
        portalInserters();
        const flush = () => {
          if (changing || editor.isDestroyed) return;
          const value = bound.getValue();
          const json = JSON.stringify(value);
          if (previous === json) return;
          const pos = getPos();
          if (pos === undefined) return;
          previous = json;
          changing = true;
          editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, {
            ...current.attrs, value, state: bound.getState(), quiet: null,
          }).setMeta('addToHistory', false).setMeta('hybridInitialization', !interacted));
          changing = false;
        };
        const owner: LiveCell = {
          position: getPos, prefix,
          flush() {
            // Draftail debounces its hidden input update, including after native
            // duplication. Save through Draftail itself before reading form data.
            // Observer callbacks only synchronize; they must not save again.
            for (const input of dom.querySelectorAll<DraftailInput>('input')) input.draftailEditor?.saveState();
            flush();
          },
          state: () => bound.getDuplicatedState?.() ?? bound.getState(),
          label: () => quiet.label(),
        };
        owners.cells.add(owner);
        const quiet = new QuietCell(dom, mount, editor, owners, options, prefix, getPos, () => {
          owner.flush();
          for (const popover of popovers) if (!popover.state.isDestroyed) popover.hide();
        }, html => {
          const pos = getPos();
          if (pos !== undefined && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, {
            ...current.attrs, quiet: html,
          }).setMeta('addToHistory', false).setMeta('hybridInitialization', true));
        }, node.attrs.quiet ?? (node.attrs.state == null ? options.defaultQuiet : null));
        // Wagtail widgets use both native and jQuery change notifications.
        window.$(dom).on('input change', flush);
        const observer = new MutationObserver(() => { portalInserters(); flush(); });
        observer.observe(dom, { subtree: true, childList: true, attributes: true });
        dom.addEventListener('pointerdown', () => {
          if (owners.active !== quiet) return;
          interacted = true;
        });
        for (const event of ['keydown', 'beforeinput', 'click']) {
          dom.addEventListener(event, () => { interacted = true; });
        }
        dom.addEventListener('click', event => {
          if (owners.active || event.shiftKey || (event.target as Element).closest('button')) return;
          const selection = editor.state.selection;
          if (selection instanceof CellSelection && selection.$anchorCell.pos !== selection.$headCell.pos) return;
          const pos = getPos();
          if (pos !== undefined) editor.commands.setCellSelection({ anchorCell: pos - 1 });
        });
        return {
          dom,
          stopEvent: event => owners.active === quiet || (event.target instanceof Element && !!event.target.closest('[data-cell-edit]')),
          ignoreMutation: () => true,
          update(updated) {
            if (updated.type !== current.type) return false;
            const value = JSON.stringify(updated.attrs.value);
            if (!changing && (value !== JSON.stringify(current.attrs.value)
              || updated.attrs.state !== current.attrs.state)) {
              changing = true;
              interacted = false;
              bound.setState(updated.attrs.state ?? options.defaultState);
              previous = JSON.stringify(bound.getValue());
              changing = false;
              quiet.replace(updated.attrs.quiet);
            }
            current = updated;
            quiet.label();
            if (owners.active !== quiet && updated.attrs.quiet != null) quiet.show(updated.attrs.quiet);
            return true;
          },
          destroy() {
            quiet.destroy();
            observer.disconnect();
            window.$(dom).off('input change', flush);
            for (const popover of popovers) if (!popover.state.isDestroyed) popover.destroy();
            owners.cells.delete(owner);
          },
        };
      };
    },
  });
}

export function cellEditorStates(editor: Editor, owners: CellEditors, formState: boolean) {
  const live = new Map([...owners.cells].map(cell => [cell.position(), cell]));
  const doc: JSONContent = editor.getJSON();
  // Match document positions using ProseMirror itself; no persisted cell IDs.
  let index = 0;
  const nodes: JSONContent[] = [];
  for (const row of doc.content?.[0]?.content ?? []) {
    for (const cell of row.content ?? []) {
      for (const child of cell.content ?? []) if (child.type === 'wagtailBlock') nodes.push(child);
    }
  }
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'wagtailBlock') return true;
    const cell = live.get(pos);
    const target = nodes[index++];
    target.attrs = formState
      ? { value: node.attrs.value, state: cell?.state() ?? node.attrs.state, quiet: node.attrs.quiet }
      : { value: node.attrs.value, ...(cell ? { prefix: cell.prefix } : {}) };
    return false;
  });
  return doc;
}
