import type { Editor } from '@tiptap/core';
import { headerConfiguration, headerEdges, type TableValue } from './editor';

export type Strings = Record<string, string>;
type Command = 'insertTable' | 'undo' | 'redo' | 'addRowBefore' | 'addRowAfter'
  | 'deleteRow' | 'addColumnBefore' | 'addColumnAfter' | 'deleteColumn'
  | 'mergeCells' | 'splitCell' | 'toggleHeaderCell' | 'toggleHeaderRow' | 'toggleHeaderColumn';

export class TableControls {
  readonly caption: HTMLInputElement;
  readonly description: HTMLTextAreaElement;
  private editor?: Editor;
  private buttons = new Map<Command, HTMLButtonElement>();
  private actions: HTMLSelectElement[] = [];
  private settings: HTMLDivElement;
  private structure: HTMLDivElement;
  private settingsButton: HTMLButtonElement;
  private structureButton: HTMLButtonElement;
  private horizontal: HTMLSelectElement;
  private vertical: HTMLSelectElement;
  private warning: HTMLElement;

  constructor(
    root: HTMLElement, private id: string, private strings: Strings,
    private signal: AbortSignal, onMetadata: () => void,
  ) {
    const toolbar = root.querySelector<HTMLElement>('[data-table-toolbar]')!;
    for (const [command, label] of [
      ['insertTable', 'Insert table'], ['undo', 'Undo'], ['redo', 'Redo'],
    ] as const) this.addButton(toolbar, command, label);

    const actions = this.addPanel(root, toolbar, 'actions', 'Table actions');
    this.structure = actions.panel;
    this.structureButton = actions.button;
    this.structure.dataset.tableActions = '';
    this.actions.push(this.addSelect(this.structure, 'rows', 'Rows', [
      ['addRowBefore', 'Add row before'], ['addRowAfter', 'Add row after'], ['deleteRow', 'Delete row'],
    ], value => this.run(value as Command)));
    this.actions.push(this.addSelect(this.structure, 'columns', 'Columns', [
      ['addColumnBefore', 'Add column before'], ['addColumnAfter', 'Add column after'], ['deleteColumn', 'Delete column'],
    ], value => this.run(value as Command)));
    const cellActions = document.createElement('div');
    cellActions.dataset.tableCellActions = '';
    this.structure.append(cellActions);
    for (const [command, label] of [
      ['mergeCells', 'Merge cells'], ['splitCell', 'Split cell'],
      ['toggleHeaderCell', 'Header cell'],
    ] as const) this.addButton(cellActions, command, label);

    const settings = this.addPanel(root, toolbar, 'settings', 'Table settings');
    this.settings = settings.panel;
    this.settingsButton = settings.button;
    this.settings.dataset.tableSettings = '';
    this.addButton(this.settings, 'toggleHeaderRow', 'First row headers');
    this.addButton(this.settings, 'toggleHeaderColumn', 'First column headers');
    this.warning = document.createElement('p');
    this.warning.textContent = strings.headerHelp
      ?? 'Custom headers: keep headers in the top rows or first column for clear relationships.';
    this.warning.hidden = true;
    this.settings.append(this.warning);
    this.horizontal = this.addSelect(this.settings, 'horizontal', 'Horizontal alignment', [
      ['left', 'Left'], ['center', 'Center'], ['right', 'Right'],
    ], value => this.editor?.chain().focus().setCellAttribute('align', value || null).run());
    this.vertical = this.addSelect(this.settings, 'vertical', 'Vertical alignment', [
      ['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom'],
    ], value => this.editor?.chain().focus().setCellAttribute('verticalAlign', value || null).run());

    const captionLabel = document.createElement('label');
    captionLabel.htmlFor = `${id}-caption`;
    captionLabel.textContent = strings.caption ?? 'Caption';
    this.caption = document.createElement('input');
    this.caption.type = 'text';
    this.caption.id = captionLabel.htmlFor;
    const descriptionLabel = document.createElement('label');
    descriptionLabel.htmlFor = `${id}-description`;
    descriptionLabel.textContent = strings.description ?? 'Description';
    this.description = document.createElement('textarea');
    this.description.id = descriptionLabel.htmlFor;
    this.description.rows = 2;
    const help = document.createElement('p');
    help.id = `${id}-metadata-help`;
    help.textContent = strings.metadataHelp
      ?? 'The caption names the table. The description explains how to read it.';
    this.caption.setAttribute('aria-describedby', help.id);
    this.description.setAttribute('aria-describedby', help.id);
    this.settings.append(captionLabel, this.caption, descriptionLabel, this.description, help);
    this.caption.addEventListener('input', onMetadata, { signal });
    this.description.addEventListener('input', onMetadata, { signal });
  }

  private addPanel(root: HTMLElement, toolbar: HTMLElement, key: string, fallback: string) {
    const panel = document.createElement('div');
    panel.id = `${this.id}-${key}-panel`;
    panel.dataset.tablePanel = '';
    panel.hidden = true;
    root.querySelector('[data-table-editor]')!.before(panel);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-small button-secondary';
    button.textContent = this.strings[key] ?? fallback;
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('mousedown', event => event.preventDefault(), { signal: this.signal });
    button.addEventListener('click', () => {
      const opening = panel.hidden;
      this.structure.hidden = this.settings.hidden = true;
      this.structureButton.setAttribute('aria-expanded', 'false');
      this.settingsButton.setAttribute('aria-expanded', 'false');
      panel.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
    }, { signal: this.signal });
    toolbar.append(button);
    return { panel, button };
  }

  private addButton(container: HTMLElement, command: Command, fallback: string) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-small button-secondary';
    button.textContent = this.strings[command] ?? (command === 'insertTable' ? this.strings.insert : undefined) ?? fallback;
    // Retain a mouse cell selection while operating on it. Keyboard activation
    // follows the normal tab order and restores the editor's native selection.
    button.addEventListener('mousedown', event => event.preventDefault(), { signal: this.signal });
    button.addEventListener('click', () => this.run(command), { signal: this.signal });
    container.append(button);
    this.buttons.set(command, button);
  }

  private addSelect(
    container: HTMLElement, key: string, fallback: string,
    choices: ReadonlyArray<readonly [string, string]>, change: (value: string) => void,
  ) {
    const label = document.createElement('label');
    label.htmlFor = `${this.id}-${key}`;
    label.textContent = this.strings[key] ?? fallback;
    const select = document.createElement('select');
    select.id = label.htmlFor;
    select.add(new Option(this.strings.choose ?? 'Choose…', ''));
    for (const [value, text] of choices) select.add(new Option(this.strings[value] ?? text, value));
    select.addEventListener('change', () => {
      const value = select.value;
      if (key === 'rows' || key === 'columns') {
        select.value = '';
        if (!value) return;
      }
      change(value);
    }, { signal: this.signal });
    container.append(label, select);
    return select;
  }

  private run(command: Command) {
    this.editor?.chain().focus()[command]().run();
  }

  setMetadata(value: TableValue | null) {
    this.caption.value = value?.caption ?? '';
    this.description.value = value?.description ?? '';
  }

  focus() {
    if (!this.structureButton.hidden) this.structureButton.focus();
    else this.buttons.get('insertTable')!.focus();
  }

  refresh(editor?: Editor) {
    this.editor = editor;
    const table = editor?.state.doc.content.content.find(node => node.type.name === 'table');
    const inTable = !!editor?.isActive('table');
    for (const [command, button] of this.buttons) {
      button.disabled = !editor || !editor.can()[command]() || (command === 'insertTable' && !!table);
    }
    this.buttons.get('insertTable')!.hidden = !!table;
    this.structureButton.hidden = this.settingsButton.hidden = !table;
    this.structure.hidden = !table || this.structureButton.getAttribute('aria-expanded') !== 'true';
    this.settings.hidden = !table || this.settingsButton.getAttribute('aria-expanded') !== 'true';
    for (const select of [...this.actions, this.horizontal, this.vertical]) select.disabled = !inTable;
    this.caption.disabled = this.description.disabled = !table;
    const mode = table ? headerConfiguration(table) : 'none';
    const headers = table ? headerEdges(table) : { row: false, column: false };
    this.buttons.get('toggleHeaderRow')!.setAttribute('aria-pressed', String(headers.row));
    this.buttons.get('toggleHeaderColumn')!.setAttribute('aria-pressed', String(headers.column));
    this.buttons.get('toggleHeaderCell')!.setAttribute('aria-pressed', String(!!editor?.isActive('tableHeader')));
    this.warning.hidden = mode !== 'custom';
    const attributes = editor?.getAttributes(editor.isActive('tableHeader') ? 'tableHeader' : 'tableCell');
    this.horizontal.value = attributes?.align ?? '';
    this.vertical.value = attributes?.verticalAlign ?? '';
  }
}
