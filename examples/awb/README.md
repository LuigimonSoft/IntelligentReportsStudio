# Air waybill example

This is an editable Report Studio sample based on the supplied AWB image. All names, identifiers, flights and amounts are fictional. The page is a visual example, not an approved airline or IATA document.

- `awb-full-form-example.json`: populated report with form rules and labels.
- `awb-data-only-example.json`: the same populated report with data positions only, for a preprinted form.
- `awb-full-form-template.json` and `awb-data-only-template.json`: equivalent designs with empty data tables.
- `awb-sample-data.json`: sample rows keyed by table ID. In Records, select a table and use **Load JSON data** with this file; repeat for the other tables. The application keeps the selected file association only for the session.
- `*-example.pdf`: preview output from the populated report examples.

Open either populated JSON with **Open**. The JSON files with populated records are intentionally self-contained examples; do not use actual customer data in a shared file. Saving from the application creates a template without the records. The sample contains one AWB: the `goods` table supplies the repeating detail rows. Shipper, consignee, agent, origin/destination airports and airline are separate role-specific tables linked to `awb`. Airport country references point to their respective country tables.

Both versions position the sample's data identically. Paper, margins, form dimensions, printer scaling and offsets must be calibrated against the actual preprinted stock. One AWB per report is supported by this sample; use a separate filtered data set for a different AWB. Overflow and multipage behavior should be checked before production use.

The goods area and its continuous rules are sized for this example's three records. If the number of records or the height of their descriptions changes, check the totals position and pagination. The reference image contains a QR code and a barcode; this example does not generate them.
