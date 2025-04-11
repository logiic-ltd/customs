import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname

class SingleAdministrativeDocument(Document):
    def autoname(self):
        """Set name for SAD"""
        self.name = make_autoname("SAD-.####")
    
    def validate(self):
        """Validate SAD document"""
        self.validate_parties()
        self.validate_items()
        self.validate_documents()
        self.calculate_totals()
        self.validate_workflow_state()

    def validate_workflow_state(self):
        """Validate workflow state transitions"""
        if self.workflow_state:
            if self.workflow_state == "Assessed" and not frappe.db.exists(
                "Tax Assessment Notice", {"declaration_number": self.name, "status": "Generated"}
            ):
                frappe.throw("Cannot move to Assessed state without a generated Tax Assessment")
            
            if self.workflow_state == "Paid" and not frappe.db.exists(
                "Tax Assessment Notice", {"declaration_number": self.name, "status": "Paid"}
            ):
                frappe.throw("Cannot move to Paid state without payment confirmation")
            
            if self.workflow_state == "Released" and not frappe.db.exists(
                "Cargo Release Order", {"declaration_number": self.name, "status": "Released"}
            ):
                frappe.throw("Cannot move to Released state without a release order")
    
    def validate_parties(self):
        """Validate importer and exporter"""
        if not self.importer:
            frappe.throw("Importer is mandatory")
        if not self.exporter:
            frappe.throw("Exporter is mandatory")
    
    def validate_items(self):
        """Validate items and HS codes"""
        if not self.items:
            frappe.throw("At least one item is required")
        
        for item in self.items:
            if not len(item.hs_code) >= 6:
                frappe.throw(f"HS Code must be at least 6 digits for item {item.item_number}")
            if item.customs_value <= 0:
                frappe.throw(f"Customs value must be greater than zero for item {item.item_number}")
    
    def validate_documents(self):
        """Validate supporting documents"""
        required_docs = ["Invoice", "Packing List"]
        submitted_docs = [d.document_type for d in self.supporting_documents]
        
        for doc_type in required_docs:
            if doc_type not in submitted_docs:
                frappe.throw(f"{doc_type} is required")

    # def calculate_totals(self):
    #     """Calculate total values including taxes"""
    #     self.total_value = sum(item.customs_value for item in self.items)
    #     self.total_weight = sum(item.weight for item in self.items)
        
    #     # Calculate tax totals
    #     self.total_duty = sum(item.duty_amount for item in self.items)
    #     self.total_vat = sum(item.vat_amount for item in self.items)
    #     self.total_excise = sum(item.dc_amount for item in self.items)
    #     self.total_payable = self.total_duty + self.total_vat + self.total_excise
    
    def on_submit(self):
        """Handle submission"""
        self.status = "Submitted"
    
    def on_cancel(self):
        """Handle cancellation"""
        self.status = "Cancelled"

@frappe.whitelist()
def calculate_totals():
    # Extract items from frappe.form_dict
    items = frappe.form_dict.get("items", None)

    if not items:
        frappe.throw("Missing 'items' argument.")

    # If items is a JSON string, parse it
    import json
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except json.JSONDecodeError:
            frappe.throw("Failed to parse 'items' as JSON.")

    # Ensure items is a list of dictionaries
    if not isinstance(items, list):
        frappe.throw("Invalid items data format. Expected a list of dictionaries.")

    # Perform calculations
    total_value = sum(item.get('customs_value', 0) for item in items)
    total_weight = sum(item.get('weight', 0) for item in items)
    total_duty = sum(item.get('duty_amount', 0) for item in items)
    total_vat = sum(item.get('vat_amount', 0) for item in items)
    total_excise = sum(item.get('dc_amount', 0) for item in items)
    total_payable = total_duty + total_vat + total_excise

    return {
        'total_value': total_value,
        'total_weight': total_weight,
        'total_duty': total_duty,
        'total_vat': total_vat,
        'total_excise': total_excise,
        'total_payable': total_payable,
    }