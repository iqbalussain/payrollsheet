# Native Mobile Payroll Redesign

## Goal
Transform the existing phone layout into the selected native enterprise direction while preserving every calculation, record, desktop screen, and workflow.

## Mobile experience
- Introduce a safe-area-aware fixed top app bar with the current screen title and a clear contextual action.
- Replace the six-item scrolling navigation with a fixed five-item native tab bar: Home, Employees, Payroll, Advances, and Costs. Keep History and Salary Slips accessible through Home.
- Apply the selected charcoal and teal palette with Sora headings, Manrope body text, restrained elevation, consistent spacing, and tactile pressed/focus states.
- Convert remaining mobile tables into touch-friendly card feeds; desktop tables remain unchanged.
- Present employee and option selection as searchable bottom sheets where it matters most.
- Add lightweight skeletons, short screen transitions, hidden scrollbars, momentum scrolling, and reduced-motion support.

## Screen updates
- Employees: native search/filter bar, summary metrics, employee cards, and direct view/edit actions.
- Monthly Payroll: retain compact employee-entry cards, improve sticky controls, hierarchy, touch sizing, and employee selection sheet.
- Advances: mobile filters, summary strip, transaction cards, and advance-entry bottom sheet.
- Cost Allocation: prominent Net, Paid, and Remaining metrics plus expandable allocation cards.
- Home: compact launcher for History and Salary Slips so no existing area becomes inaccessible.

## Technical boundaries
- Frontend presentation only; no changes to payroll formulas, stored data, or cloud configuration.
- Use existing semantic design tokens and current button patterns.
- Verify the result on a phone viewport, including navigation, scrolling, sheets, and key payroll screens.
