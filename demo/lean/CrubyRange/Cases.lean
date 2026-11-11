import CrubyRange.Basic

/-! # Concrete inputs used by the known answers, the proofs and the non-vacuity checks -/

namespace CrubyRange

/-- `[1,2][0..LONG_MAX]` -/
def caseEndMax : Input := { b := some 0, e := some MAX, excl := false, n := 2, err := 0 }

/-- `R = -1..LONG_MAX` with err = 1 (e.g. `values_at`): two wrap-arounds. -/
def caseDouble : Input := { b := some (-1), e := some MAX, excl := false, n := 2, err := 1 }

/-- `[1,2][0..1]`: an ordinary read with no overflow. -/
def caseNormal : Input := { b := some 0, e := some 1, excl := false, n := 2, err := 0 }

/-- O2: `LONG_MAX..LONG_MIN` with err = 1 and n = 2. -/
def caseO2 : Input := { b := some MAX, e := some MIN, excl := false, n := 2, err := 1 }

end CrubyRange
