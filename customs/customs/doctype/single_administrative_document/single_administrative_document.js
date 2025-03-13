frappe.ui.form.on('Single Administrative Document', {
    hs_code_search: function(frm) {
        if (frm.doc.hs_code_search) {
            frappe.call({
                method: 'customs.customs.api.tariff.search_hs_codes',
                args: {
                    'search_text': frm.doc.hs_code_search
                },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        // Show search results in a dialog
                        let d = new frappe.ui.Dialog({
                            title: 'Select HS Code',
                            fields: [{
                                fieldtype: 'HTML',
                                fieldname: 'results',
                                options: `
                                    <div style="max-height: 400px; overflow-y: auto;">
                                        <table class="table table-bordered">
                                            <thead>
                                                <tr>
                                                    <th>HS Code</th>
                                                    <th>Description</th>
                                                    <th>Category</th>
                                                    <th>Duty</th>
                                                    <th>VAT</th>
                                                    <th>Excise</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${r.message.map(item => `
                                                    <tr class="hs-code-row clickable" data-item='${JSON.stringify(item)}'>
                                                        <td><strong>${item.hs_code}</strong></td>
                                                        <td>
                                                            <div><strong>${item.description}</strong></div>
                                                            <small class="text-muted">${item.category_type || ''}</small>
                                                        </td>
                                                        <td>${item.chapter || ''}</td>
                                                        <td class="text-right">${item.duty}%</td>
                                                        <td class="text-right">${item.vat}%</td>
                                                        <td class="text-right">${item.dc}%</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                    <style>
                                        .clickable { cursor: pointer; }
                                        .clickable:hover { background-color: #f8f9fa; }
                                        .text-right { text-align: right; }
                                        .text-muted { color: #6c757d; }
                                    </style>
                                `
                            }]
                        });
                        
                        // Handle row click
                        d.$wrapper.find('.hs-code-row').click(function() {
                            let item = JSON.parse($(this).attr('data-item'));
                            // Add a new row to the items table
                            let new_row = frappe.model.add_child(frm.doc, 'SAD Item', 'items');
                            frappe.model.set_value(new_row.doctype, new_row.name, {
                                'hs_code': item.hs_code,
                                'description': item.description,
                                'duty_rate': item.duty,
                                'vat_rate': item.vat,
                                'dc_rate': item.dc
                            });
                            frm.refresh_field('items');
                            // Clear the search field
                            frm.set_value('hs_code_search', '');
                            d.hide();
                        });
                        
                        d.show();
                    }
                }
            });
        }
    },
    refresh: function(frm) {
        // Set focus to search box
        frm.set_df_property('hs_code_search', 'description', 'Type to search, then click an item to add it to the list below');
    }
});
