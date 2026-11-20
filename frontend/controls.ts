import type { Editor } from '@tiptap/core';
import { headerConfiguration, headerEdges, selectedCellAlignment, type TableValue } from './editor';

type Command = 'insertTable' | 'addRowBefore' | 'addRowAfter'
  | 'deleteRow' | 'addColumnBefore' | 'addColumnAfter' | 'deleteColumn'
  | 'mergeCells' | 'splitCell' | 'toggleHeaderCell' | 'toggleHeaderRow' | 'toggleHeaderColumn';

declare global {
  interface Window {
    wagtail?: {
      app: {
        getControllerForElementAndIdentifier(element: Element, identifier: string): { hide(): void } | null;
      };
    };
  }
}

export class TableControls {
  readonly caption: HTMLInputElement;
  readonly description: HTMLTextAreaElement;
  private editor?: Editor;
  private buttons = new Map<Command, HTMLButtonElement>();
  private menus: HTMLElement[];
  private rowButton: HTMLButtonElement;
  private horizontal: HTMLButtonElement[];
  private vertical: HTMLButtonElement[];
  private warning: HTMLElement;

  constructor(root: HTMLElement, id: string, signal: AbortSignal, onMetadata: () => void) {
    this.menus = [...root.querySelectorAll<HTMLElement>('[data-table-menu]')];
    this.rowButton = root.querySelector<HTMLButtonElement>('[data-table-menu="row"] .w-dropdown__toggle')!;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-table-command]')) {
      const command = button.dataset.tableCommand as Command;
      this.buttons.set(command, button);
      button.addEventListener('mousedown', event => event.preventDefault(), { signal });
      button.addEventListener('click', () => {
        this.closeMenus();
        this.editor?.chain().focus()[command]().run();
      }, { signal });
    }
    for (const menu of this.menus) {
      const toggle = menu.querySelector<HTMLButtonElement>('.w-dropdown__toggle')!;
      // Keep ProseMirror's mouse selection while opening a menu. Keyboard users
      // use Wagtail's normal tab order and the editor's retained selection.
      toggle.addEventListener('mousedown', event => event.preventDefault(), { signal });
      toggle.addEventListener('click', () => this.closeMenus(menu), { signal });
      menu.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        this.closeMenus();
        toggle.focus();
      }, { signal });
    }

    this.horizontal = [...root.querySelectorAll<HTMLButtonElement>('[data-table-align]')];
    this.vertical = [...root.querySelectorAll<HTMLButtonElement>('[data-table-valign]')];
    for (const button of [...this.horizontal, ...this.vertical]) {
      button.addEventListener('mousedown', event => event.preventDefault(), { signal });
      button.addEventListener('click', () => {
        const horizontal = button.hasAttribute('data-table-align');
        const value = horizontal ? button.dataset.tableAlign : button.dataset.tableValign;
        const attributes = { [horizontal ? 'align' : 'verticalAlign']: value || null };
        this.closeMenus();
        // Native setCellAttribute stops when its first cell already has the value.
        // Compose Tiptap's attribute commands so mixed ranges are updated fully.
        this.editor?.chain().focus().command(({ commands }) => {
          const cells = commands.updateAttributes('tableCell', attributes);
          const headers = commands.updateAttributes('tableHeader', attributes);
          return cells || headers;
        }).run();
      }, { signal });
    }

    this.caption = root.querySelector('[data-table-caption]')!;
    this.description = root.querySelector('[data-table-description]')!;
    this.caption.id = `${id}-caption`;
    this.description.id = `${id}-description`;
    for (const input of [this.caption, this.description]) {
      const field = input.closest<HTMLElement>('[data-field-wrapper]')!;
      const label = field.querySelector<HTMLLabelElement>('label')!;
      label.htmlFor = input.id;
      label.id = `${input.id}-label`;
      const help = field.querySelector<HTMLElement>('[data-field-help]')!;
      help.id = `${input.id}-helptext`;
      input.setAttribute('aria-describedby', help.id);
    }
    this.caption.addEventListener('input', onMetadata, { signal });
    this.description.addEventListener('input', onMetadata, { signal });
    this.warning = root.querySelector('[data-table-header-help]')!;
  }

  private closeMenus(except?: HTMLElement) {
    for (const menu of this.menus) {
      if (menu === except) continue;
      window.wagtail?.app.getControllerForElementAndIdentifier(menu, 'w-dropdown')?.hide();
    }
  }

  setMetadata(value: TableValue | null) {
    this.caption.value = value?.caption ?? '';
    this.description.value = value?.description ?? '';
  }

  focus() {
    const insert = this.buttons.get('insertTable')!;
    (insert.hidden ? this.rowButton : insert).focus();
  }

  refresh(editor?: Editor) {
    this.editor = editor;
    const table = editor?.state.doc.content.content.find(node => node.type.name === 'table');
    const inTable = !!editor?.isActive('table');
    if (!table) this.closeMenus();
    for (const [command, button] of this.buttons) {
      button.disabled = !editor || !editor.can()[command]() || (command === 'insertTable' && !!table);
    }
    this.buttons.get('insertTable')!.hidden = !!table;
    for (const menu of this.menus) {
      menu.hidden = !table;
      menu.querySelector<HTMLButtonElement>('.w-dropdown__toggle')!.disabled = !editor || !table;
    }
    this.caption.disabled = this.description.disabled = !table;
    const headers = table ? headerEdges(table) : { row: false, column: false };
    this.buttons.get('toggleHeaderRow')!.setAttribute('aria-pressed', String(headers.row));
    this.buttons.get('toggleHeaderColumn')!.setAttribute('aria-pressed', String(headers.column));
    this.buttons.get('toggleHeaderCell')!.setAttribute('aria-pressed', String(!!editor?.isActive('tableHeader')));
    this.warning.hidden = !table || headerConfiguration(table) !== 'custom';
    const alignment = editor ? selectedCellAlignment(editor.state) : { align: undefined, verticalAlign: undefined };
    for (const button of this.horizontal) {
      button.disabled = !inTable;
      if (button.dataset.tableAlign) {
        button.setAttribute('aria-pressed', String(inTable && alignment.align === button.dataset.tableAlign));
      } else {
        button.removeAttribute('aria-pressed');
      }
    }
    for (const button of this.vertical) {
      button.disabled = !inTable;
      if (button.dataset.tableValign) {
        button.setAttribute('aria-pressed', String(inTable && alignment.verticalAlign === button.dataset.tableValign));
      } else {
        button.removeAttribute('aria-pressed');
      }
    }
  }

  destroy() {
    this.closeMenus();
    // Deleted StreamField blocks can remain mounted and hidden. Removing the
    // controller disconnects Wagtail's dropdowns and destroys their popovers.
    for (const menu of this.menus) menu.removeAttribute('data-controller');
    for (const button of [...this.horizontal, ...this.vertical]) button.removeAttribute('data-controller');
  }
}
