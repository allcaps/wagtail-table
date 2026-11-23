import type { Editor } from '@tiptap/core';
import { TableMap } from '@tiptap/pm/tables';
import type { BlockOptions, CellEditors } from './hybrid';

/** A passive value and an explicit native editing surface, independent of storage. */
export class QuietCell {
  readonly preview = document.createElement('div');
  readonly pencil = document.createElement('button');
  readonly done = document.createElement('button');
  private request?: AbortController;
  private destroyed = false;

  constructor(
    readonly dom: HTMLElement,
    private mount: HTMLElement,
    private editor: Editor,
    private owners: CellEditors,
    private options: BlockOptions,
    private prefix: string,
    private position: () => number | undefined,
    private flush: () => void,
    private rendered: (html: string | null) => void,
    html: string | null | undefined,
  ) {
    this.preview.dataset.cellQuiet = '';
    this.pencil.type = this.done.type = 'button';
    this.pencil.dataset.cellEdit = '';
    this.pencil.className = 'wagtail-table-cell-edit';
    // Use Wagtail's icon sprite; labels remain on the button.
    this.pencil.innerHTML = '<svg class="icon icon-edit" aria-hidden="true"><use href="#icon-edit"></use></svg>';
    this.done.dataset.cellDone = '';
    this.done.className = 'button button-small button-secondary';
    this.done.textContent = options.doneLabel ?? 'Done';
    this.done.hidden = true;
    this.mount.hidden = true;
    this.dom.prepend(this.preview, this.pencil);
    this.dom.append(this.done);
    this.show(html);
    this.label();
    this.pencil.addEventListener('click', () => this.open());
    this.done.addEventListener('click', () => this.close());
  }

  label() {
    const pos = this.position();
    if (pos === undefined) return;
    const resolved = this.editor.state.doc.resolve(pos);
    for (let depth = resolved.depth; depth > 0; depth--) {
      if (resolved.node(depth).type.spec.tableRole !== 'table') continue;
      const rect = TableMap.get(resolved.node(depth)).findCell(pos - resolved.start(depth) - 1);
      const label = (this.options.editLabel ?? 'Edit cell, row %(row)s, column %(column)s')
        .replace('%(row)s', String(rect.top + 1)).replace('%(column)s', String(rect.left + 1));
      this.pencil.setAttribute('aria-label', label);
      this.pencil.title = label;
      return;
    }
  }

  show(html: string | null | undefined) {
    this.preview.removeAttribute('aria-busy');
    // HTML comes only from our server's passive allowlist, never from raw values.
    this.preview.innerHTML = html ?? '';
  }

  replace(html: string | null | undefined) {
    this.request?.abort();
    this.show(html);
    if (html == null && this.owners.active !== this) void this.refresh();
  }

  open() {
    if (this.destroyed || this.owners.active === this) return;
    this.owners.active?.close(false);
    this.request?.abort();
    const pos = this.position();
    if (pos !== undefined) this.editor.commands.setCellSelection({ anchorCell: pos - 1 });
    this.owners.active = this;
    this.dom.dataset.cellEditing = '';
    this.preview.hidden = this.pencil.hidden = true;
    this.mount.hidden = this.done.hidden = false;
    this.editor.view.dom.setAttribute('role', 'group');
    this.editor.view.dom.removeAttribute('aria-multiline');
    this.editor.view.dom.dataset.cellEditing = '';
    this.editor.view.dispatch(this.editor.state.tr.setMeta('hybridEditing', true));
    const input = this.mount.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, [contenteditable=true]')
      ?? this.mount.querySelector<HTMLButtonElement>('button');
    (input ?? this.done).focus();
  }

  close(returnFocus = true) {
    if (this.owners.active !== this) return;
    this.flush();
    this.leave();
    if (returnFocus) this.pencil.focus();
    void this.refresh();
  }

  private leave(notify = true) {
    delete this.owners.active;
    delete this.dom.dataset.cellEditing;
    this.mount.hidden = this.done.hidden = true;
    this.preview.hidden = this.pencil.hidden = false;
    if (!notify) {
      // Node destruction can happen inside ProseMirror's DOM update. Resume
      // after that update rather than dispatching a nested transaction.
      queueMicrotask(() => this.resumeTable());
    } else this.resumeTable();
  }

  private resumeTable() {
    if (!this.editor.isDestroyed && !this.owners.active) {
      delete this.editor.view.dom.dataset.cellEditing;
      this.editor.view.dom.setAttribute('role', 'textbox');
      this.editor.view.dom.setAttribute('aria-multiline', 'true');
      this.editor.view.dispatch(this.editor.state.tr.setMeta('hybridEditing', false));
    }
  }

  async refresh() {
    this.request?.abort();
    if (!this.options.quietUrl || this.destroyed) return;
    const request = this.request = new AbortController();
    this.preview.textContent = this.options.quietLoading ?? 'Updating cell content…';
    this.preview.setAttribute('aria-busy', 'true');
    const data = new FormData();
    const form = this.dom.closest('form');
    if (!form) { this.show(null); return; }
    for (const [name, value] of new FormData(form)) {
      if (name === this.prefix || name.startsWith(`${this.prefix}-`)) data.append(name, value);
    }
    data.set('prefix', this.prefix);
    data.set('definition', this.options.quietDefinition ?? '');
    const csrf = form.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value ?? '';
    try {
      const response = await fetch(this.options.quietUrl, {
        method: 'POST', body: data, signal: request.signal,
        headers: { 'X-CSRFToken': csrf }, credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Quiet rendering failed.');
      const result = await response.json();
      if (request.signal.aborted || this.destroyed) return;
      const html = typeof result.html === 'string' ? result.html : null;
      this.show(html);
      this.rendered(html);
    } catch {
      if (!request.signal.aborted && !this.destroyed) this.show(null);
    }
  }

  destroy() {
    this.destroyed = true;
    this.request?.abort();
    if (this.owners.active === this) this.leave(false);
  }
}
