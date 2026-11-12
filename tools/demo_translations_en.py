#!/usr/bin/env python3
"""Source of demo/translations.en.json (hand-written English translations of the demo).

Keyed by file path and block id as numbered by src/core.js splitLean.
Run: python3 tools/demo_translations_en.py > demo/translations.en.json
"""
import json, sys


def E(id, title, math="", proof="", lean="", src=""):
    return {"id": id, "title": title, "math": math, "proof": proof, "lean": lean, "src": src}


BASIC = [
E("b0", "Module doc: common definitions",
r"""The target is `rb_range_component_beg_len` and `rb_range_beg_len` in `range.c` of ruby/ruby `1f2a4bd5750b…`, on an LP64 platform where `rb_len_t` is a 64-bit `long`."""),
E("b2", "Definition: MIN (LONG_MIN)",
r"""$\mathrm{MIN} = -2^{63}$, the value of `LONG_MIN` on LP64."""),
E("b3", "Definition: MAX (LONG_MAX)",
r"""$\mathrm{MAX} = 2^{63} - 1$, the value of `LONG_MAX` on LP64."""),
E("b4", "Structure: the input of one call",
r"""The arguments of one call `rb_range_component_beg_len(b, e, excl, &beg, &len, n, err)`:

- `b`: the start of the range (an integer or `nil`)
- `e`: the end of the range (an integer or `nil`)
- `excl`: whether the end is excluded (true for `a...b`, false for `a..b`)
- `n`: the length of the receiver (the C variable `len`)
- `err`: a flag for what the caller does with the result (0, 1 or 2)

Values that become integers through `#to_int` are out of scope.""",
lean=r"""`none` in `Option Int` stands for Ruby's `nil`. `deriving Repr, DecidableEq` asks Lean to generate printing and a decidable equality test."""),
E("b5", "Definition: inputs in scope (Valid)",
r"""$$\mathrm{Valid}(i) :\iff (b = x \Rightarrow \mathrm{MIN} \le x \le \mathrm{MAX}) \wedge (e = x \Rightarrow \mathrm{MIN} \le x \le \mathrm{MAX}) \wedge 0 \le n \le \mathrm{MAX} \wedge err \le 2$$
An endpoint that does not fit in `long` makes `NUM2LEN` raise before the function body runs, so such inputs are excluded.""",
lean=r"""`∀ x, i.b = some x → …` reads "if b is an integer x, then …"; when b is `nil` the condition holds trivially. The definition returns a `Prop`: it names a statement, it does not compute a truth value."""),
E("b6", "Inductive type: the result of the function (Out)",
r"""One of:

- `ok beg len`: the function returns `Qtrue` and stores beg and len in `*begp` and `*lenp`
- `out`: the function returns `Qnil` (the C label `out_of_range`)"""),
E("b7", "Inductive type: the result of an implementation model (ChkOut)",
r"""`Out` plus a third case `overflow` (the model hit signed overflow). Used for models that detect overflow."""),
E("b8", "Definition: embedding Out into ChkOut",
r"""Maps `ok b l` to `ok b l` and `out` to `out`. It lets the specification S (which returns `Out`) be compared with the implementation models (which return `ChkOut`)."""),
]

CASES = [
E("b1", "Module doc: concrete inputs",
r"""Concrete inputs used by the known answers, the proofs and the non-vacuity checks (checks that the hypotheses of a statement can actually be met)."""),
E("b3", "Definition: caseEndMax (`[1,2][0..LONG_MAX]`)",
r"""$b = 0,\ e = \mathrm{MAX}$, end included, $n = 2,\ err = 0$: the Ruby expression `[1,2][0..LONG_MAX]`."""),
E("b4", "Definition: caseDouble (two wrap-arounds)",
r"""$b = -1,\ e = \mathrm{MAX}$, end included, $n = 2,\ err = 1$: the range `-1..LONG_MAX` used with err = 1 (e.g. `values_at`). The 64-bit arithmetic wraps around twice."""),
E("b5", "Definition: caseNormal (an ordinary read)",
r"""$b = 0,\ e = 1$, end included, $n = 2,\ err = 0$: `[1,2][0..1]`, an ordinary read with no overflow."""),
E("b6", "Definition: caseO2 (an instance of O2)",
r"""$b = \mathrm{MAX},\ e = \mathrm{MIN}$, end included, $n = 2,\ err = 1$: the range `LONG_MAX..LONG_MIN`, which meets the overflow condition O2."""),
]

SPEC = [
E("b1", "Module doc: the specification S",
r"""A specification over mathematical integers that does not depend on the statement order of the C code. `PROPERTIES.md` gives it in prose."""),
E("b3", "Definition: the normalized start B",
r"""With $b_0$ the start (0 if `nil`):
$$B = \begin{cases} b_0 + n & (b_0 < 0) \\ b_0 & (b_0 \ge 0) \end{cases}$$
Negative values count from the end."""),
E("b4", "Definition: the normalized (exclusive) end E",
r"""If the end is `nil` (an endless range), $E = n$. Otherwise normalize the end e to $e' = e + n$ when $e < 0$ and $e' = e$ otherwise, and
$$E = e' + \begin{cases} 0 & (\text{end excluded}) \\ 1 & (\text{end included}) \end{cases}$$
So E is one past the last index."""),
E("b5", "Definition: the specification S (the intended interval)",
r"""$$S(i) = \begin{cases} \mathrm{out} & (B < 0) \\ \mathrm{ok}\bigl(B,\ \max(E - B,\ 0)\bigr) & (err = 1) \\ \mathrm{out} & (n < B) \\ \mathrm{ok}\bigl(B,\ \max(\min(E, n) - B,\ 0)\bigr) & (\text{otherwise}) \end{cases}$$

- err ∈ {0, 2}: the selected indices are $[B, E) \cap [0, n)$; a start past the end is out of range.
- err = 1: the interval $[B, E)$ is not clipped at n (it may extend the receiver).

S always returns this mathematical interval. It does not model what should happen when the interval does not fit in `long` (for err = 1, len or B + len above `LONG_MAX`), and it never raises. Whether the results are representable is examined separately (`P1_repr`, `P4`).""",
lean=r"""`max (E - B) 0` keeps the length non-negative. All comparisons and arithmetic are in `Int` (unbounded integers), so nothing overflows here."""),
]

IMPL = [
E("b1", "Module doc: the implementation models M_chk and M_wrap",
r"""Both follow `rb_range_component_beg_len` (range.c, ruby/ruby 1f2a4bd) statement by statement; they differ only in how a `long` addition or subtraction behaves.

The quoted C code does the following:

1. Take the start beg (0 if nil) and the end end (−1 if nil). If the end is nil, treat the end as not excluded.
2. If beg < 0, add len; if it is still negative, the range is out of range.
3. If end < 0, add len.
4. If the end is included, increment end.
5. If err is 0 or 2: beg > len means out of range, and end > len is clipped to len.
6. len = end − beg, or 0 if negative."""),
E("b3", "Definition: checked long arithmetic",
r"""$$\mathrm{checked}(x) = \begin{cases} \mathrm{some}\ x & (\mathrm{MIN} \le x \le \mathrm{MAX}) \\ \mathrm{none} & (\text{otherwise: signed overflow}) \end{cases}$$"""),
E("b4", "Definition: wrap-around to 64 bits",
r"""$$\mathrm{wrap64}(x) = \bigl((x - \mathrm{MIN}) \bmod 2^{64}\bigr) + \mathrm{MIN}$$
The two's-complement wrap-around to 64 bits. The result always lies in $[\mathrm{MIN}, \mathrm{MAX}]$.""",
lean=r"""`%` is `Int.emod`, which is non-negative for a positive divisor; that is why the result stays between $\mathrm{MIN}$ and $\mathrm{MAX}$."""),
E("b5", "Definition: the function body, parameterized by the arithmetic",
r"""arith gives the result of a `long` addition or subtraction (`none` means overflow). For an input i:

1. $b_0$ = the start (0 if nil), $e_0$ = the end (−1 if nil). If the end is nil, treat it as not excluded.
2. $\mathit{beg} = \mathrm{arith}(b_0 + n)$ if $b_0 < 0$, else $\mathit{beg} = b_0$. If $\mathit{beg} < 0$, the result is `out`.
3. $e_1 = \mathrm{arith}(e_0 + n)$ if $e_0 < 0$, else $e_1 = e_0$.
4. $e_2 = \mathrm{arith}(e_1 + 1)$ if the end is included, else $e_2 = e_1$.
5. If err ∈ {0, 2}: $n < \mathit{beg}$ gives `out`, and $e_3 = n$ when $e_2 > n$ (otherwise $e_3 = e_2$).
6. $l = \mathrm{arith}(e_3 - \mathit{beg})$; the result is $\mathrm{ok}(\mathit{beg},\ \max(l, 0))$.

If arith returns `none` at any step, the result is `overflow`.""",
lean=r"""`match … with | none => … | some x => …` splits on the result of each operation. `i.b.getD 0` takes the value out of the Option, using 0 for `none`. `&&` in `clip && i.n < beg` is Boolean "and".""",
src=r"""Each `--` comment quotes the range.c statement being modeled; the body corresponds statement by statement to the C code quoted in the module doc."""),
E("b6", "Definition: M_chk (checked)",
r"""$M_{chk}(i) = \mathrm{body}(\mathrm{checked}, i)$. Every `long` operation is checked, and leaving $[\mathrm{MIN}, \mathrm{MAX}]$ gives `overflow`. Conservative with respect to the C semantics."""),
E("b7", "Definition: M_wrap (64-bit wrap-around)",
r"""$M_{wrap}(i) = \mathrm{body}(x \mapsto \mathrm{some}(\mathrm{wrap64}(x)), i)$. Every `long` operation wraps around modulo $2^{64}$; it never returns `overflow`.""",
lean=r"""It matches the generated code only when `-fno-strict-overflow` is in effect (CRuby's configure adds it; checked with gcc 13 and clang 18). Without it, signed overflow is undefined behavior and this model does not apply."""),
]

STATEMENTS = [
E("b1", "Module doc: propositions P1–P4 (statements only)",
r"""These are `Prop` definitions, not theorems: they say exactly what is proved or refuted. The proofs are in `CrubyRange/Proofs.lean`. All arithmetic and comparisons are over `Int` (no wrap-around)."""),
E("b3", "Heading: P1, agreement with the specification (main goal)"),
E("b4", "Proposition P1: wherever M_chk does not overflow, it agrees with S",
r"""$$\forall i,\quad \mathrm{Valid}(i) \;\wedge\; M_{chk}(i) \ne \mathrm{overflow} \;\Longrightarrow\; M_{chk}(i) = S(i)$$""",
lean=r"""`(spec i).toChk` on the right is the result of S (an `Out`) embedded into `ChkOut`."""),
E("b5", "Proposition P1_repr: for err ∈ {0, 2}, the result of S fits in long",
r"""$$\forall i,\quad \mathrm{Valid}(i) \wedge err \ne 1 \wedge S(i) = \mathrm{ok}(b, l) \;\Longrightarrow\; \mathrm{MIN} \le b \le \mathrm{MAX} \;\wedge\; \mathrm{MIN} \le l \le \mathrm{MAX}$$"""),
E("b6", "Heading: P3, arithmetic safety (main goal)"),
E("b7", "Definition: overflow condition O1",
r"""$$O_1(i) :\iff 0 \le B \;\wedge\; e = \mathrm{MAX} \;\wedge\; \text{end included}$$
`end++` overflows for a range whose end is `LONG_MAX`.""",
src=r"""`end++` at range.c:1925."""),
E("b8", "Definition: overflow condition O2 (err = 1 only)",
r"""$$O_2(i) :\iff err = 1 \;\wedge\; 0 \le B \;\wedge\; E - B < \mathrm{MIN}$$
`end - beg` falls below `LONG_MIN`.""",
src=r"""`end - beg` at range.c:1932."""),
E("b9", "Proposition P3: M_chk overflows exactly on O1 and O2",
r"""$$\forall i,\quad \mathrm{Valid}(i) \;\Longrightarrow\; \bigl(M_{chk}(i) = \mathrm{overflow} \iff O_1(i) \vee O_2(i)\bigr)$$
Being an equivalence, it says both that nothing else overflows and that O1 and O2 always do."""),
E("b10", "Corollary P3_safe: common uses never overflow",
r"""$$\forall i,\quad \mathrm{Valid}(i) \wedge err \ne 1 \wedge (e \ne \mathrm{MAX} \vee \text{end excluded}) \;\Longrightarrow\; M_{chk}(i) \ne \mathrm{overflow}$$
For err ∈ {0, 2}, an exclusive range, or a range whose end is not `LONG_MAX`, never overflows."""),
E("b11", "Heading: P2, saturation at the upper end (element reads only)"),
E("b12", "Proposition P2(f): the model f saturates at the upper end",
r"""$$\forall i,\quad \mathrm{Valid}(i) \wedge err = 0 \wedge \text{end included} \wedge e = e_0 \wedge n - 1 \le e_0 \;\Longrightarrow\; f(i) = f(i[e := \mathrm{nil}])$$
An inclusive range whose end is at or past the last index gives the same result as the endless range (`b..`).""",
lean=r"""`{ i with e := none }` is i with only the end replaced by `nil`. The statement is about any model f; the comment expects it to hold for S and to fail for M_wrap at `e = LONG_MAX`."""),
E("b13", "Heading: P4, output contract (with a survey of what callers rely on)"),
E("b14", "Definition: a candidate contract on an ok result",
r"""For a result $\mathrm{ok}(\mathit{beg}, \mathit{len})$:
$$0 \le \mathit{beg} \;\wedge\; 0 \le \mathit{len} \;\wedge\; \begin{cases} \mathit{beg} + \mathit{len} \le \mathrm{MAX} & (err = 1) \\ \mathit{beg} \le n \;\wedge\; \mathit{beg} + \mathit{len} \le n & (\text{otherwise}) \end{cases}$$
`out` and `overflow` are unconstrained.""",
lean=r"""The sums are computed in `Int`, so the contract itself cannot overflow. `| _ => True` means "holds unconditionally in the other cases"."""),
E("b15", "Proposition P4(f): the model f satisfies the contract",
r"""$$\forall i,\quad \mathrm{Valid}(i) \;\Longrightarrow\; \mathrm{Contract}\bigl(i, f(i)\bigr)$$"""),
]

FIXED = [
E("b1", "Module doc: the fix under test (ruby/ruby#19824)",
r"""`patches/range-beg-len-overflow.patch` (commit d4d80a35 of gotoken/ruby `fix-range-beg-len-overflow`, the head of #19824) changes two statements of `rb_range_component_beg_len`:

- When the end is included, increment `end` only if `end < RB_LEN_MAX`. `RB_LEN_MAX + 1` is not representable, so it saturates instead of overflowing.
- `len = end > beg ? end - beg : 0;` Since beg is non-negative here, `end - beg` cannot overflow.

It also documents: "On success, `*begp` and `*lenp` are non-negative and their sum does not exceed `RB_LEN_MAX`" (`fix_doc_contract` in `FixedProofs.lean`). `bodyFixed` is `body` with exactly these two changes."""),
E("b3", "Definition: the patched function body",
r"""It differs from `body` in two places only:

1. When the end is included: if $e_1 \ge \mathrm{MAX}$ then $e_2 = e_1$ (saturation), otherwise $e_2 = \mathrm{arith}(e_1 + 1)$.
2. $\mathit{len} = \mathrm{arith}(e_3 - \mathit{beg})$ only when $\mathit{beg} < e_3$; otherwise $\mathit{len} = 0$.

The other steps (normalizing the start and end, clipping for err ∈ {0, 2}) are the same as in `body`.""",
lean=r"""`decide (MAX ≤ end1)` turns the proposition into a Bool for the `if`. `||` in `excl || …` is Boolean "or"."""),
E("b4", "Definition: the patched M_chk",
r"""$M_{chk}^{fixed}(i) = \mathrm{bodyFixed}(\mathrm{checked}, i)$: the patched body with checked arithmetic."""),
E("b5", "Definition: the patched M_wrap",
r"""$M_{wrap}^{fixed}(i) = \mathrm{bodyFixed}(x \mapsto \mathrm{some}(\mathrm{wrap64}(x)), i)$: the patched body with 64-bit wrap-around, which is what a GCC build actually runs."""),
E("b6", "Definition: specSat (S with the end capped at LONG_MAX)",
r"""With $E' = \min(E, \mathrm{MAX})$ and otherwise the same formula as S:
$$\mathrm{specSat}(i) = \begin{cases} \mathrm{out} & (B < 0) \\ \mathrm{ok}\bigl(B,\ \max(E' - B,\ 0)\bigr) & (err = 1) \\ \mathrm{out} & (n < B) \\ \mathrm{ok}\bigl(B,\ \max(\min(E', n) - B,\ 0)\bigr) & (\text{otherwise}) \end{cases}$$
It differs from S only for err = 1 on O1 inputs, where S's end `LONG_MAX + 1` is not representable as a `long`."""),
]

out = {
    "lean/CrubyRange/Basic.lean": {e["id"]: e for e in BASIC},
    "lean/CrubyRange/Cases.lean": {e["id"]: e for e in CASES},
    "lean/CrubyRange/Spec.lean": {e["id"]: e for e in SPEC},
    "lean/CrubyRange/Impl.lean": {e["id"]: e for e in IMPL},
    "lean/CrubyRange/Statements.lean": {e["id"]: e for e in STATEMENTS},
    "lean/CrubyRange/Fixed.lean": {e["id"]: e for e in FIXED},
}
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
print()
