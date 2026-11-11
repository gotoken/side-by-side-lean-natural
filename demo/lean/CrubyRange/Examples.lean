import CrubyRange.Spec
import CrubyRange.Impl
import CrubyRange.Cases
import CrubyRange.Fixed

/-!
# Known answers

Concrete evaluations checked by the kernel. The right-hand sides are the
outputs of the pinned CRuby (`harness/beg_len.c`, normal build) recorded in
`docs/findings-2026-11-10.md`; S gives the intended result.
-/

namespace CrubyRange

-- `[1,2][0..LONG_MAX]`
example : mWrap caseEndMax = .ok 0 0 := by decide
example : mChk caseEndMax = .overflow := by decide
example : spec caseEndMax = .ok 0 2 := by decide

-- `[1,2][0..100]`
example : mWrap { caseEndMax with e := some 100 } = .ok 0 2 := by decide

-- `R = -1..LONG_MAX` with err = 1: two wrap-arounds
example : mWrap caseDouble = .ok 1 MAX := by decide
example : spec caseDouble = .ok 1 MAX := by decide  -- B + len = MAX + 1: not representable

-- The same range with err = 0: S clips, M_wrap does not.
example : mWrap { caseDouble with err := 0 } = .ok 1 MAX := by decide
example : spec { caseDouble with err := 0 } = .ok 1 1 := by decide

-- `[1,2][0..1]`
example : mWrap caseNormal = .ok 0 2 := by decide
example : mChk caseNormal = .ok 0 2 := by decide
example : spec caseNormal = .ok 0 2 := by decide

-- O2: `LONG_MAX..LONG_MIN` with err = 1
example : mWrap caseO2 = .ok MAX 4 := by decide
example : mChk caseO2 = .overflow := by decide
example : spec caseO2 = .ok MAX 0 := by decide

/-! ## The proposed fix on the same inputs -/

example : mChkFixed caseNormal = .ok 0 2 := by decide
example : mChkFixed caseEndMax = .ok 0 2 := by decide          -- was ok 0 0
example : mChkFixed { caseDouble with err := 0 } = .ok 1 1 := by decide  -- was ok 1 MAX
example : mChkFixed caseDouble = .ok 1 (MAX - 1) := by decide  -- saturated; S has MAX
example : mChkFixed caseO2 = .ok MAX 0 := by decide            -- was ok MAX 4

end CrubyRange

