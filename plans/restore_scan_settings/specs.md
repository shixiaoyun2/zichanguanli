# Recovery Plan: Scan Page Settings

Restore the ability to select specific barcode formats and the decoding engine in the Asset Scan page.

## Problem Statement
A previous update simplified the settings modal in `Scan.tsx`, removing the UI elements that allowed users to select which barcode formats (e.g., QR Code, EAN-13, Code 128) the scanner should attempt to decode. While the underlying logic still supports these settings, the user interface is missing.

## Affected Components
- `src/pages/Scan.tsx`: The settings modal JSX needs to be updated to include format selection.

## Proposed Changes
1.  **UI Update in `Scan.tsx`**: Add a multi-select interface (using a grid of buttons or checkboxes) to the settings modal to allow users to toggle specific formats from `SUPPORTED_FORMATS_OPTIONS`.
2.  **State Management**: Ensure the `settings.formats` array is updated correctly when formats are toggled in the UI.
3.  **Engine Selection**: Keep the existing engine selection (Default vs Native) but ensure it's clearly labeled.

## Verification
- Open the settings modal in the Scan page.
- Select/deselect barcode formats.
- Save settings.
- Verify that the scanner configuration updated to reflect the selected formats.
