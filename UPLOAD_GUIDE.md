# File Upload Guide

## Required Column Names (Case-Insensitive)

The system accepts files with the following column names:

| Backend Name | Accepted Header Names | Required | Type |
|--------------|----------------------|----------|------|
| `barcode` | barcode, BARCODE, barcode_no, BARCODE_NO | Yes | String |
| `batchNo` | batchNo, BATCHNO, batch_no, BATCH_NO, batchNumber | Yes | String |
| `stackNo` | stackNo, STACKNO, stack_no, STACK_NO, stackNumber | Yes | String |
| `expectedQuantity` | expectedQuantity, EXPECTEDQUANTITY, expected_quantity, EXPECTED_QUANTITY, quantity, qty | Yes | Number (>0) |

## File Formats

- ✅ CSV (.csv)
- ✅ Excel (.xlsx)
- ✅ Excel 97-2003 (.xls)

## Example File Structure

### Minimum Required Format
```
barcode,batchNo,stackNo,expectedQuantity
BC-1001,BATCH-01,STACK-A,25
BC-1002,BATCH-01,STACK-B,40
BC-1003,BATCH-02,STACK-C,12
```

### Alternative Header Formats (All Valid)
```
BARCODE,BATCHNO,STACKNO,EXPECTEDQUANTITY
11011,BATCH001,ST001,100
11012,BATCH001,ST002,150

--- OR ---

Barcode No,Batch No,Stock No,Expected Qty
PRD-001,B001,S001,50
PRD-002,B001,S002,75
```

## Validation Rules

1. **Barcode**: 
   - Must not be empty
   - Must be unique across the file
   - Cannot duplicate existing barcodes

2. **Batch Number**:
   - Must not be empty
   - Any string format accepted

3. **Stack Number**:
   - Must not be empty
   - Any string format accepted

4. **Expected Quantity**:
   - Must be > 0
   - Must be a valid number
   - No decimal values (integers only)

## Upload Progress

- Real-time progress bar shows upload percentage
- Backend processes file upon successful upload
- All records are validated before insertion
- Successful message shows number of items imported

## Error Handling

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid columns" | Wrong column headers | Use correct column names from table above |
| "No data rows found" | File has only headers | Add data rows to file |
| "barcode must not be empty" | Column has empty cell | Fill all required columns |
| "Duplicate barcode" | Same barcode appears twice | Ensure all barcodes are unique |
| "expectedQuantity must be a positive number" | Invalid or <= 0 quantity | Use positive numbers only |

## Download Template

Use the "Download Template" button on the Inventory Upload page to get a CSV template with the correct column structure.

## Tips

- Excel files: First sheet is used
- Column names are case-insensitive
- Whitespace is automatically trimmed
- Upload replaces all existing inventory data
- Always backup current inventory before uploading
