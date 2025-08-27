// /js/abastecimiento/shared/datatable.js
export const setDTDefaults = () => {
if (!$.fn?.dataTable) return;
$.extend(true, $.fn.dataTable.defaults, {
pageLength: 25,
responsive: true,
autoWidth: false,
language: {
url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
}
});
};


export const adjust = (selector) => {
const table = $(selector).DataTable?.();
table?.columns?.().every(function(){ this.adjust(); });
};