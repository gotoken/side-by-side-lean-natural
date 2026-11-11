import CrubyRange.Statements
import CrubyRange.Cases
import CrubyRange.Fixed

/-!
# Non-vacuity

For every theorem in `Proofs.lean`, a concrete input that meets all of its
premises, so that none of them holds only because its premises are
unsatisfiable. For P3 both sides of the equivalence are realised.
-/

namespace CrubyRange

theorem caseNormal_valid : caseNormal.Valid := by simp [Input.Valid, caseNormal, MIN, MAX]
theorem caseEndMax_valid : caseEndMax.Valid := by simp [Input.Valid, caseEndMax, MIN, MAX]
theorem caseDouble_valid : caseDouble.Valid := by simp [Input.Valid, caseDouble, MIN, MAX]
theorem caseO2_valid : caseO2.Valid := by simp [Input.Valid, caseO2, MIN, MAX]

/-- P1: valid, M_chk does not overflow, and the result is an ordinary `ok`. -/
example : caseNormal.Valid ∧ mChk caseNormal ≠ .overflow ∧ mChk caseNormal = .ok 0 2 :=
  ⟨caseNormal_valid, by decide, by decide⟩

/-- P1_repr: valid, `err ≠ 1`, and S returns `ok`. -/
example : caseNormal.Valid ∧ caseNormal.err ≠ 1 ∧ spec caseNormal = .ok 0 2 :=
  ⟨caseNormal_valid, by decide, by decide⟩

/-- P3, no overflow and neither O1 nor O2. -/
example : caseNormal.Valid ∧ mChk caseNormal ≠ .overflow ∧ ¬ (O1 caseNormal ∨ O2 caseNormal) := by
  refine ⟨caseNormal_valid, by decide, ?_⟩
  simp [O1, O2, caseNormal, specBeg, specEnd, MIN, MAX]

/-- P3, overflow through O1. -/
example : caseEndMax.Valid ∧ mChk caseEndMax = .overflow ∧ O1 caseEndMax := by
  refine ⟨caseEndMax_valid, by decide, ?_⟩
  simp [O1, caseEndMax, specBeg]

/-- P3, overflow through O2 (and not O1). -/
example : caseO2.Valid ∧ mChk caseO2 = .overflow ∧ O2 caseO2 ∧ ¬ O1 caseO2 := by
  refine ⟨caseO2_valid, by decide, ?_, ?_⟩
  · simp [O2, caseO2, specBeg, specEnd, MIN, MAX]
  · simp [O1, caseO2, specBeg, MIN, MAX]

/-- P3_safe: valid, `err ≠ 1`, and an end other than `LONG_MAX`. -/
example : caseNormal.Valid ∧ caseNormal.err ≠ 1 ∧ caseNormal.e ≠ some MAX :=
  ⟨caseNormal_valid, by decide, by decide⟩

/-- P2: valid, `err = 0`, inclusive, and the end is at the last index. -/
example : caseNormal.Valid ∧ caseNormal.err = 0 ∧ caseNormal.excl = false ∧
    caseNormal.e = some 1 ∧ caseNormal.n - 1 ≤ 1 :=
  ⟨caseNormal_valid, rfl, rfl, rfl, by decide⟩

/-- P4 for S and M_chk with `err ∈ {0,2}`: an `ok` result to check. -/
example : caseNormal.Valid ∧ caseNormal.err ≠ 1 ∧ (spec caseNormal).toChk = .ok 0 2 ∧
    mChk caseNormal = .ok 0 2 :=
  ⟨caseNormal_valid, by decide, by decide, by decide⟩

/-- P4 for S with `err = 1`: both sides of the equivalence occur. -/
example : caseO2.Valid ∧ caseO2.err = 1 ∧ ¬ O1 caseO2 ∧
    caseDouble.Valid ∧ caseDouble.err = 1 ∧ O1 caseDouble := by
  refine ⟨caseO2_valid, rfl, ?_, caseDouble_valid, rfl, ?_⟩
  · simp [O1, caseO2, specBeg, MIN, MAX]
  · simp [O1, caseDouble, specBeg]

/-! ## The fix (`FixedProofs.lean`)

`fix_no_overflow`, `fix_eq_specSat`, `fix_p2` and `fix_p4` have the same
premises as the theorems above (`caseNormal` meets them). The remaining ones: -/

/-- `specSat_eq_spec` and `fix_eq_spec_clip`: valid and `err ≠ 1`. -/
example : caseNormal.Valid ∧ caseNormal.err ≠ 1 ∧ ¬ (caseNormal.err = 1 ∧ O1 caseNormal) :=
  ⟨caseNormal_valid, by decide, fun h => absurd h.1 (by decide)⟩

/-- The exception in `specSat_eq_spec` is real: on `caseDouble` (err = 1, O1)
specSat and S differ. -/
example : caseDouble.err = 1 ∧ O1 caseDouble ∧ specSat caseDouble ≠ spec caseDouble := by
  refine ⟨rfl, ?_, by decide⟩
  simp [O1, caseDouble, specBeg]

/-- `fix_preserves`: valid and the original does not overflow. -/
example : caseNormal.Valid ∧ mChk caseNormal ≠ .overflow :=
  ⟨caseNormal_valid, by decide⟩

end CrubyRange
