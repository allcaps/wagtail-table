import { Extension } from '@tiptap/core';

export const VerticalAlignment = Extension.create({
  name: 'verticalAlignment',
  addGlobalAttributes() {
    return [{
      types: ['tableCell', 'tableHeader'],
      attributes: {
        verticalAlign: {
          default: null,
          parseHTML: element => {
            const value = element.style.verticalAlign || element.getAttribute('data-vertical-align')
              || ['top', 'middle', 'bottom'].find(value => element.classList.contains(`wagtail-table-valign-${value}`));
            return ['top', 'middle', 'bottom'].includes(value ?? '') ? value : null;
          },
          renderHTML: attributes => ['top', 'middle', 'bottom'].includes(attributes.verticalAlign)
            ? { class: `wagtail-table-valign-${attributes.verticalAlign}` } : {},
        },
      },
    }];
  },
});
