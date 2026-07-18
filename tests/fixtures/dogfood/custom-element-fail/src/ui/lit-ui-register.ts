// FIXTURE PROVENANCE: named after the REAL orphan module identified by the
// react-doctor audit, VD SIGNAL FORT (internal rule matrix,
// not shipped with this package, §1.2 rule 4): "ui/
// lit-ui-register.ts, module jamais importé depuis l'entry-point". This
// fixture reproduces exactly that shape — the define() call site exists,
// but no other file in the tree imports this module.
class GptuIconButton extends HTMLElement {}
customElements.define("gptu-icon-button", GptuIconButton);
