import CrubyRange.Statements
import CrubyRange.Cases

/-!
# Proofs of P1, P1_repr, P2, P3, P3_safe and P4

Each proof splits on the shape of the input (`nil` or Integer endpoints,
inclusive or exclusive), unfolds the definitions and lets `grind` do the
case analysis on the `if`s and the linear integer arithmetic.
-/

namespace CrubyRange

/-- P1: wherever M_chk does not overflow, it agrees with S. -/
theorem p1 : P1 := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩ hno
  dsimp only at hb he hn0 hnM herr
  rcases (by omega : err = 0 ∨ err = 1 ∨ err = 2) with rfl | rfl | rfl <;>
    cases b <;> cases e <;> cases excl <;>
      simp [mChk, body, checked, spec, specBeg, specEnd, Out.toChk, MIN, MAX] at * <;>
      grind

/-- P1_repr: for `err ∈ {0,2}`, S's result fits in `long`. -/
theorem p1_repr : P1_repr := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩ herr1 beg len hs
  cases b <;> cases e <;> cases excl <;>
    simp only [spec, specBeg, specEnd, MIN, MAX] at * <;>
    grind

/-- P3: M_chk overflows exactly on O1 or O2. -/
theorem p3 : P3 := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩
  cases b <;> cases e <;> cases excl <;>
    simp only [mChk, body, checked, O1, O2, specBeg, specEnd, MIN, MAX] at * <;>
    grind

/-- P3_safe: for `err ∈ {0,2}`, an exclusive range or an end other than
`LONG_MAX` never overflows. -/
theorem p3_safe : P3_safe := by
  intro i hv herr hcond hov
  have := (p3 i hv).mp hov
  rcases this with ⟨_, he, hx⟩ | ⟨h1, _⟩
  · rcases hcond with h | h
    · exact h he
    · simp [h] at hx
  · exact herr h1

/-! ## P2: saturation at the upper end -/

/-- P2 holds for S. -/
theorem p2_spec : P2 (fun i => (spec i).toChk) := by
  rintro ⟨b, e', excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩ herr0 hexcl e hee hge
  dsimp only at hb he hn0 hnM herr herr0 hexcl hee hge
  subst herr0 hexcl hee
  cases b <;>
    simp [spec, specBeg, specEnd, Out.toChk, MIN, MAX] at * <;>
    grind

/-- P2 fails for M_wrap: `[1,2][0..LONG_MAX]` differs from `[1,2][0..]`. -/
theorem not_p2_wrap : ¬ P2 mWrap := by
  intro h
  have hv : caseEndMax.Valid := by simp [Input.Valid, caseEndMax, MIN, MAX]
  have := h caseEndMax hv rfl rfl MAX rfl (by decide)
  revert this
  decide

/-! ## P4: output contract, in four parts -/

/-- P4 for S with `err ∈ {0,2}`: the contract holds. -/
theorem p4_spec_clip : ∀ i : Input, i.Valid → i.err ≠ 1 → Contract i (spec i).toChk := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩ herr1
  dsimp only at hb he hn0 hnM herr herr1
  cases b <;> cases e <;> cases excl <;>
    simp [Contract, spec, specBeg, specEnd, Out.toChk, MIN, MAX] at * <;>
    grind

/-- P4 for S with `err = 1`: the contract fails exactly on O1, i.e. when the
inclusive end is `LONG_MAX` and the start is in range (`B + len = MAX + 1`). -/
theorem p4_spec_err1 :
    ∀ i : Input, i.Valid → i.err = 1 → (Contract i (spec i).toChk ↔ ¬ O1 i) := by
  rintro ⟨b, e, excl, n, err⟩ ⟨hb, he, hn0, hnM, herr⟩ herr1
  dsimp only at hb he hn0 hnM herr herr1
  subst herr1
  cases b <;> cases e <;> cases excl <;>
    simp [Contract, spec, specBeg, specEnd, Out.toChk, O1, MIN, MAX] at * <;>
    grind

/-- P4 holds for M_chk: every `ok` result of M_chk satisfies the contract.
Derived from P1 (M_chk agrees with S where it does not overflow), P3 (it
overflows on O1) and the two results for S above. -/
theorem p4_chk : P4 mChk := by
  intro i hv
  by_cases hov : mChk i = .overflow
  · rw [hov]; exact True.intro
  · rw [p1 i hv hov]
    by_cases h1 : i.err = 1
    · exact (p4_spec_err1 i hv h1).mpr (fun ho => hov ((p3 i hv).mpr (Or.inl ho)))
    · exact p4_spec_clip i hv h1

/-- P4 fails for M_wrap, already for a read (`err = 0`): `[1,2][-1..LONG_MAX]`
gives `beg = 1, len = LONG_MAX` although `n = 2`. -/
theorem not_p4_wrap : ¬ P4 mWrap := by
  intro h
  have hv : ({ caseDouble with err := 0 } : Input).Valid := by
    simp [Input.Valid, caseDouble, MIN, MAX]
  have hc := h _ hv
  have hw : mWrap { caseDouble with err := 0 } = .ok 1 MAX := by decide
  rw [hw] at hc
  simp [Contract, caseDouble, MAX] at hc

/-- The same range with `err = 1` (e.g. `values_at`) also breaks the contract:
`beg + len = LONG_MAX + 1`. -/
theorem wrap_breaks_contract_err1 :
    caseDouble.Valid ∧ ¬ Contract caseDouble (mWrap caseDouble) := by
  refine ⟨by simp [Input.Valid, caseDouble, MIN, MAX], ?_⟩
  have hw : mWrap caseDouble = .ok 1 MAX := by decide
  rw [hw]
  simp [Contract, caseDouble, MAX]

end CrubyRange
