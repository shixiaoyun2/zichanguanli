# Recovery Plan: Scan Page Settings & Recognition Optimization

Restore the ability to select specific barcode formats and the decoding engine, and ensure recognition performance matches the "high success rate" of the previous version.

## Comparison Results
After comparing the "old version" code with the current `Scan.tsx`, I found that:
1.  **Core Logic**: The scanning logic (`formatsToSupport` and `useBarCodeDetectorIfSupported`) is already correctly implemented in the current code.
2.  **UI Regression**: The "Settings Modal" was simplified and lost the "Supported Formats" selection grid.
3.  **Recognition Rate**: The higher success rate of the old version was due to the user being able to manually "lock" a specific format (like EAN-13), which reduces false positives and improves speed. Currently, users are stuck with the default or can't see/change the restricted set.

## Proposed Changes
1.  **Restore Settings UI**: Replace the "Simplified" settings modal with the full version from the old code, including:
    *   **Format Selection Grid**: A scrollable list of toggleable barcode formats (`SUPPORTED_FORMATS_OPTIONS`).
    *   **Engine Multi-select**: Clearer labels for "Zxing (Standard)" vs "Native (Browser)".
2.  **Refine Settings State**: Ensure the toggling logic correctly updates the `settings.formats` array.
3.  **UI Polish**: Keep the modern styling of the current app while re-integrating the old settings content.

## Verification
- Open Settings Modal: Should see "Supported Formats" and "Decoding Engine".
- Toggle formats: Should show checkmarks and update state.
- Save & Scan: Verify scanner restarts and successfully recognizes selected formats.
