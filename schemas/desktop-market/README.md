# Desktop market contract fixtures

These JSON Schemas are pinned wire-contract fixtures copied from the DSH Desktop
community-market package. They are used only for conformance tests; DSH Gate
does not import Desktop runtime code and does not declare a loadable Desktop
plugin or provider.

- Source repository: `https://github.com/anywhere-labs/deepseek-harness-desktop`
- Source package: `dsh-community-market`
- Source commit: `4d54ab869660d0c3697530b09d5e3757bd79e50f`
- Source paths: `docs/schemas/catalog-source.schema.json`, `docs/schemas/catalog-provider-page.schema.json`
- Source package license: MIT

The source schemas are draft `1.0.0` contracts. Update the commit and rerun the
conformance suite together when the Desktop contract changes.
