// Grade-based difficulty caps for math practice. A kid's grade (2-5) limits the
// largest operand they see. null/unknown grade → full range.

export const GRADES = [2, 3, 4, 5];

// Multiplication: largest table/operand (e.g. grade 2 → up to 9×9).
export const MUL_MAX_BY_GRADE = { 2: 9, 3: 12, 4: 15, 5: 20 };
export const DEFAULT_MUL_MAX = 20;

// Addition/subtraction: largest operand and result (grade 2 → up to 20, else 40).
export const ADDSUB_MAX_BY_GRADE = { 2: 20, 3: 40, 4: 40, 5: 40 };
export const DEFAULT_ADDSUB_MAX = 40;

// Squares / square roots: largest base n (so √ tops out at n²). Grade 2 → 1..10
// (√ up to 100); grade 5 → 1..20 (√ up to 400).
export const SQUARE_MAX_BY_GRADE = { 2: 10, 3: 12, 4: 15, 5: 20 };
export const DEFAULT_SQUARE_MAX = 20;

export function mulMaxForGrade(grade) {
  return MUL_MAX_BY_GRADE[grade] ?? DEFAULT_MUL_MAX;
}

export function addSubMaxForGrade(grade) {
  return ADDSUB_MAX_BY_GRADE[grade] ?? DEFAULT_ADDSUB_MAX;
}

export function squareMaxForGrade(grade) {
  return SQUARE_MAX_BY_GRADE[grade] ?? DEFAULT_SQUARE_MAX;
}
