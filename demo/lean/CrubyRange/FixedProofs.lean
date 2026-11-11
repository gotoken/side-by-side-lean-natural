import CrubyRange.Statements
import CrubyRange.Fixed
import CrubyRange.Proofs

/-!
# Properties of the proposed fix

* `fix_no_overflow`: in the model of the patched function (64-bit `long`,
  inputs satisfying `Input.Valid`), no modelled `long` operation overflows.
  For the modelled arithmetic this removes the dependence on how signed
  overflow is treated.
* `fix_preserves`: wherever the original did not overflow, the patched
  function returns exactly what the original returned.
* `fix_eq_specSat`, `specSat_eq_spec`, `fix_eq_spec_clip`: the patched
  function agrees with S, except for `err = 1` on O1 inputs, where S's end
  `LONG_MAX + 1` is not representable and the fix uses `LONG_MAX`.
* `fix_p2`, `fix_p4`: P2 and P4, which fail for the original (M_wrap),
  hold for the patched function.
* `fix_doc_contract`: the contract stated in the patched doc comment.

All of this is about the Lean model. That the model follows the C code is
established by review and by the differential test against the patched
CRuby (gcc 13), not by proof; so is the conclusion that the C function has
no signed overflow on these inputs.
-/

namespace CrubyRange

theorem fix_no_overflow : ∀ i : Input, i.Valid → mChkFixed i ≠ .overflow := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩
  dsimp only at hb he hn0 hnM herr
  rcases (by omega : err = 0 ∨ err = 1 ∨ err = 2) with rfl | rfl | rfl <;>
    cases b <;> cases e <;> cases excl <;>
      simp [mChkFixed, bodyFixed, checked, MIN, MAX] at * <;>
      grind (splits := 30)

theorem fix_eq_specSat : ∀ i : Input, i.Valid → mChkFixed i = (specSat i).toChk := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩
  dsimp only at hb he hn0 hnM herr
  rcases (by omega : err = 0 ∨ err = 1 ∨ err = 2) with rfl | rfl | rfl <;>
    cases b <;> cases e <;> cases excl <;>
      simp [mChkFixed, bodyFixed, checked, specSat, specBeg, specEnd, Out.toChk, MIN, MAX] at * <;>
      grind (splits := 30)

theorem specSat_eq_spec :
    ∀ i : Input, i.Valid → ¬ (i.err = 1 ∧ O1 i) → specSat i = spec i := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩ hno
  dsimp only at hb he hn0 hnM herr
  rcases (by omega : err = 0 ∨ err = 1 ∨ err = 2) with rfl | rfl | rfl <;>
    cases b <;> cases e <;> cases excl <;>
      simp [specSat, spec, specBeg, specEnd, O1, MIN, MAX] at * <;>
      grind

/-- For reads and string writes the patched function agrees with S exactly. -/
theorem fix_eq_spec_clip :
    ∀ i : Input, i.Valid → i.err ≠ 1 → mChkFixed i = (spec i).toChk := by
  intro i hv herr
  rw [fix_eq_specSat i hv, specSat_eq_spec i hv (fun h => herr h.1)]

/-- Wherever the original did not overflow, the fix changes nothing. -/
theorem fix_preserves : ∀ i : Input, i.Valid → mChk i ≠ .overflow → mChkFixed i = mChk i := by
  intro i hv hno
  rw [fix_eq_specSat i hv, p1 i hv hno]
  have : ¬ O1 i := fun ho => hno ((p3 i hv).mpr (Or.inl ho))
  rw [specSat_eq_spec i hv (fun h => this h.2)]

theorem fix_p2 : P2 mChkFixed := by
  intro i hv herr hexcl e he hge
  have hv' : ({ i with e := none } : Input).Valid := by
    obtain ⟨hb, _, hn0, hnM, herr2⟩ := hv
    exact ⟨hb, by simp, hn0, hnM, herr2⟩
  have h1 := fix_eq_spec_clip i hv (by omega)
  have h2 := fix_eq_spec_clip { i with e := none } hv' (by simp; omega)
  rw [h1, h2]
  exact p2_spec i hv herr hexcl e he hge

theorem fix_p4 : P4 mChkFixed := by
  intro i hv
  rw [fix_eq_specSat i hv]
  by_cases h1 : i.err = 1
  · by_cases ho : O1 i
    · -- the saturated interval: B + len = LONG_MAX
      obtain ⟨b, e, excl, n, err⟩ := i
      obtain ⟨hb, he, hn0, hnM, herr⟩ := hv
      dsimp only at hb he hn0 hnM herr h1 ho ⊢
      subst h1
      cases b <;> cases e <;> cases excl <;>
        simp [Contract, specSat, specBeg, specEnd, Out.toChk, O1, MIN, MAX] at * <;>
        grind
    · rw [specSat_eq_spec i hv (fun h => ho h.2)]
      exact (p4_spec_err1 i hv h1).mpr ho
  · rw [specSat_eq_spec i hv (fun h => h1 h.1)]
    exact p4_spec_clip i hv h1

/-- The contract in the doc comment added by ruby/ruby#19824: "On success,
`*begp` and `*lenp` are non-negative and their sum does not exceed
`RB_LEN_MAX`." -/
theorem fix_doc_contract :
    ∀ i : Input, i.Valid → ∀ b l, mChkFixed i = .ok b l → 0 ≤ b ∧ 0 ≤ l ∧ b + l ≤ MAX := by
  intro i hv b l h
  have hc := fix_p4 i hv
  rw [h] at hc
  have hnM : i.n ≤ MAX := hv.2.2.2.1
  by_cases h1 : i.err = 1 <;> simp [Contract, h1] at hc <;> omega

end CrubyRange
