frappe.ui.form.on('Single Administrative Document', {
    refresh: function (frm) {
        // Set a description for the search field
        frm.set_df_property('hs_code_search', 'description', 'Type to search, then click an item to add it to the list below');

        // Add a custom HTML field for search and dropdown dynamically
        frm.fields_dict.hs_code_search.$wrapper.html(`
            <div class="frappe-control input-max-width">
                <div class="form-group d-flex align-items-start">
                    <!-- Label on the Left -->
                    <label class="control-label" style="flex: 0 0 25%; margin-right: 50px;">
                        ${frm.fields_dict.hs_code_search.df.label}
                    </label>
                    
                    <!-- Input, Description, and Results on the Right -->
                    <div style="flex: 1;">
                        <div class="control-input-wrapper">
                            <input type="text" id="custom_hs_code_search" 
                                   class="form-control" 
                                   placeholder="${frm.fields_dict.hs_code_search.df.placeholder || 'Type to search HS Codes...'}">
                        </div>
                        <div class="help-box" id="description-box" style="margin-top: 8px;">
                            ${frm.fields_dict.hs_code_search.df.description || 'Type to search and select from results.'}
                        </div>
                        <div id="custom_hs_code_results" 
                             style="display: none; max-height: 200px; overflow-y: auto; 
                                    border: 1px solid #ccc; border-radius: 8px; 
                                    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1); 
                                    margin-top: 8px; background: #ffffff; z-index: 1000; position: absolute; width: 100%; padding: 8px 0;">
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Attach the input event listener for the search functionality
        $('#custom_hs_code_search').on('input', frappe.utils.debounce(function () {
            let search_text = $(this).val();

            if (search_text.length > 1) {
                $('#description-box').hide(); // Hide description when dropdown appears
                frappe.call({
                    method: 'customs.customs.api.tariff.search_hs_codes', // API for search results
                    args: { search_text: search_text },
                    callback: function (r) {
                        if (r.message && r.message.length > 0) {
                            // Populate dropdown with results
                            let results_html = r.message.map(item => `
                                <div class="custom-hs-code-item" 
                                    data-item='${JSON.stringify(item)}' 
                                    style="padding: 12px; cursor: pointer; 
                                           border-bottom: 1px solid #ddd; 
                                           font-size: 14px; 
                                           color: #333; background: #fff; 
                                           transition: background 0.2s ease, border-left-color 0.2s ease; 
                                           border-left: 4px solid transparent;">
                                    <strong>${item.hs_code}</strong> - ${item.description}
                                </div>
                            `).join('');

                            $('#custom_hs_code_results').html(results_html).show();

                            // Attach click event to add items to the table
                            $('.custom-hs-code-item').on('click', function () {
                                let item = JSON.parse($(this).attr('data-item'));

                                // Add item to the table
                                if (!frm.doc.items || frm.doc.items.length === 0 || (frm.doc.items.length === 1 && !frm.doc.items[0].hs_code)) {
                                    let first_row = frm.doc.items[0] || frappe.model.add_child(frm.doc, 'SAD Item', 'items');
                                    frappe.model.set_value(first_row.doctype, first_row.name, {
                                        hs_code: item.hs_code,
                                        description: item.description,
                                        duty_rate: item.duty,
                                        vat_rate: item.vat,
                                        dc_rate: item.dc
                                    });
                                } else {
                                    let new_row = frappe.model.add_child(frm.doc, 'SAD Item', 'items');
                                    frappe.model.set_value(new_row.doctype, new_row.name, {
                                        hs_code: item.hs_code,
                                        description: item.description,
                                        duty_rate: item.duty,
                                        vat_rate: item.vat,
                                        dc_rate: item.dc
                                    });
                                }

                                // Refresh the table and clear the search field
                                frm.refresh_field('items');
                                $('#custom_hs_code_search').val('');
                                $('#custom_hs_code_results').hide();
                                $('#description-box').show();
                            });
                        } else {
                            $('#custom_hs_code_results').html('<div style="padding: 8px;">No matching HS Codes found.</div>').show();
                        }
                    }
                });
            } else {
                $('#custom_hs_code_results').hide();
                $('#description-box').show(); // Show description when input is cleared
            }
        }, 300)); // Debounce to prevent excessive API calls

        // Add a "Calculate Totals" button to populate the Tax Calculation table
        frm.add_custom_button('Populate Tax Calculation Table', function () {
            if (!frm.doc.items || frm.doc.items.length === 0) {
                frappe.msgprint('No items to calculate totals.');
                return;
            }

            // Prepare data for the server
            const items = frm.doc.items.map(item => ({
                customs_value: item.customs_value || 0,
                weight: item.weight || 0,
                duty_amount: item.duty_rate || 0,
                vat_amount: item.vat_rate || 0,
                dc_amount: item.dc_rate || 0
            }));
            
            console.log("Mapped items data:", JSON.stringify(items)); // Log to verify


            // Ensure items is always a list, even if only one item exists
            frappe.call({
                method: 'customs.customs.doctype.single_administrative_document.single_administrative_document.calculate_totals',
                args: { items: items}, // Wrap in a list if needed
                callback: function (r) {
                    if (r.message) {
                        const totals = r.message;

                        frm.clear_table('tax_calculation');

                        const tax_types = [
                            { tax_type: 'Import duty', base_amount: totals.total_duty },
                            { tax_type: 'VAT', base_amount: totals.total_vat },
                            { tax_type: 'Excise Tax', base_amount: totals.total_excise },
                            { tax_type: 'Other', base_amount: 0 }
                        ];

                        tax_types.forEach(tax => {
                            const row = frappe.model.add_child(frm.doc, 'Tax Calculation', 'tax_calculation');
                            frappe.model.set_value(row.doctype, row.name, {
                                tax_type: tax.tax_type,
                                base_amount: tax.base_amount,
                                rate: 0,
                                tax_amount: 0
                            });
                        });

                        frm.refresh_field('tax_calculation');
                        frappe.msgprint('Tax Calculation table populated successfully.');
                    } else {
                        frappe.msgprint('Failed to populate Tax Calculation table.');
                    }
                }
            });
        });
    }
});