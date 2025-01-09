# 4.1 Add-ons Marketplace Testing

## Prerequisites

- VS Code with extension installed
- Authenticated Heroku session
- Active Heroku application selected
- Appropriate permissions for installing/managing add-on
- Active internet connection
- Test app repository containing an `app.json` cloned locally and open in VSCode
- At least 1 app attached to the workspace and displayed in the extension.

## Test Cases

### 1. Marketplace Interface

#### Initial Load

1. Open Add-ons Marketplace view by expanding the "ADD-ONS" tree item in the Heroku Resource Explorer
2. Verify a WebView is displayed with a header containing:
   - Heroku icon displays
   - "Add-ons Marketplace" title shows
   - App name appears correctly
3. Confirm loading indicator appears
4. Wait for add-ons list to populate

#### Expected Results

- Loading indicator shows during fetch
- Add-ons display in grid layout
- Each add-on card shows:
  - Provider branded logo image
  - Add-on name
  - Provider information
  - Install button

### 2. Search Functionality

#### Basic Search

1. Locate search field with search icon
2. Enter search term
3. Verify real-time filtering
4. Test search field accessibility (optional):
   - Screen reader compatibility
   - Proper ARIA labels
   - Keyboard navigation

#### Category Filtering

1. Click "Filter by" dropdown
2. Test each category selection
3. Combine with search terms in the search input
4. Clear filters

#### Expected Results

- Search filters add-ons in real-time
- Category filter updates list correctly
- Combined filters work properly
- Clear filters restores full list

### 3. Add-on Installation

#### Plan Selection

1. Click "Install" on an add-on card
2. Verify plan dropdown appears
3. Test different plan selections
4. Observe pricing information shows clearly

#### Installation Process

1. Verify the submit button is disabled
2. Select specific plan
3. Verify the submit button is enabled
4. Click "Submit" button
5. *Verify the newly installed add-on displays in the Heroku Resource Explorer *This can take time and some free add-on
   plans never emit log stream events and will not display until the "Refresh" button is clicked in the Heroku Resource
   Explorer header

#### Expected Results

- Plan options display correctly
- Progress ring shows during installation
- Success/failure status clear
- Add-on appears in app resources

#### Modify Add-on Plan

1. Search for an installed add-on card
2. Verify the "Modify plan" button exists
3. Click "Modify plan" and choose a different plan
4. Click "Submit"
5. Verify plan has been updated by right clicking on the add-on in the Heroku Resource Explorer and choosing "Details"

#### Expected Results

- Plan options display correctly
- The newly changed plan is visible in when viewing the plan details (right click on it in the Explorer - choose
  "Details" )

#### State Change to card when Removing a add-on

- Use the category dropdown to filter by "installed"
- With the WebView still visible, right click on the add-on in the Heroku Resource Explorer
- Choose "Permanently delete" from the context menu
- Follow instructions to delete the add-on
- Verify the removed addon card disappears from the "installed" category
- Verify the removed addon is available in the "show all" category.

#### Expected Results

- The add-on card in the Marketplace webview updates to reflect state changes that occur externally.

#### Invalid States

1. Test with:
   - Invalid plan selection (e.g. some basic and free add-on plans are not available on premium tier dynos)
   - Incompatible add-ons
2. Verify error handling

## Validation Checklist

### Interface Elements

- [ ] Header displays correctly
- [ ] Search field functions
- [ ] Category dropdown populated
- [ ] Add-on cards render properly
- [ ] Progress indicators work
- [ ] Plan selection dropdown functions

### Search and Filter

- [ ] Real-time search works
- [ ] Category filtering accurate
- [ ] Combined filters function
- [ ] Clear filters restores state

### Installation Flow

- [ ] Plan selection works
- [ ] Pricing displays correctly
- [ ] Progress indication shows
- [ ] Installation completes
- [ ] Error states handled

### Accessibility

- [ ] ARIA labels present
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Focus management correct

3. Installation Failures
   - Invalid plan selection
   - Resource conflicts

## Important Notes

- Add-on availability varies by region
- Plan changes may require confirmation
- Some add-ons have dependencies

## Command Reference

```typescript
// Search debounce timing
private static readonly SEARCH_DEBOUNCE_MS = 300;

// Category filter
categories.addEventListener('change', () => {
    this.filterAddons();
});

// Installation trigger
button.addEventListener('click', async () => {
    await this.installAddon(addon, button);
});
```

## Cleanup Steps

1. Remove test add-ons by right clicking on it in the Heroku Resource Explorer and choosing "Permanently delete"
2. Verify removal completion
3. Check app configuration
4. Reset filter selections
5. Verify add-on was removed from the Heroku Resource Explorer
