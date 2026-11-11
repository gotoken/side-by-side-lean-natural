#!/usr/bin/env python3
"""Source of demo/translations.ja.json (hand-written Japanese translations of the demo).

Keyed by file path and block id as numbered by src/core.js splitLean.
Run: python3 tools/demo_translations_ja.py > demo/translations.ja.json
"""
import json, sys


def E(id, title, math="", proof="", lean="", src=""):
    return {"id": id, "title": title, "math": math, "proof": proof, "lean": lean, "src": src}


BASIC = [
E("b0", "モジュール説明: 共通の定義",
r"""対象は ruby/ruby `1f2a4bd5750b…` の `range.c` にある `rb_range_component_beg_len` と `rb_range_beg_len`。LP64 環境（`rb_len_t` が 64 ビットの `long`）を前提とする。"""),
E("b2", "定義: MIN（LONG_MIN）",
r"""$\mathrm{MIN} = -2^{63}$。LP64 での `LONG_MIN`。"""),
E("b3", "定義: MAX（LONG_MAX）",
r"""$\mathrm{MAX} = 2^{63} - 1$。LP64 での `LONG_MAX`。"""),
E("b4", "構造体: 1 回の呼び出しの入力",
r"""`rb_range_component_beg_len(b, e, excl, &beg, &len, n, err)` の 1 回の呼び出しに渡すものを並べた組。

- `b`: 範囲の始点（整数、または `nil`）
- `e`: 範囲の終点（整数、または `nil`）
- `excl`: 終点を含まないか（`a...b` なら真、`a..b` なら偽）
- `n`: 対象の長さ（C の `len`）
- `err`: 呼び出し側の用途を表すフラグ（0・1・2）

`#to_int` を経由して整数になる値は対象外。""",
lean=r"""`Option Int` の `none` が Ruby の `nil` にあたる。`deriving Repr, DecidableEq` は表示と等号判定を自動で用意する指定。"""),
E("b5", "定義: 対象とする入力（Valid）",
r"""$$\mathrm{Valid}(i) :\iff (b = x \Rightarrow \mathrm{MIN} \le x \le \mathrm{MAX}) \wedge (e = x \Rightarrow \mathrm{MIN} \le x \le \mathrm{MAX}) \wedge 0 \le n \le \mathrm{MAX} \wedge err \le 2$$
端点が `long` に収まらない場合は、関数本体に入る前に `NUM2LEN` が例外を出すので、対象から外している。""",
lean=r"""`∀ x, i.b = some x → …` は「b が整数 x なら …」。b が `nil` のときは条件なしに成り立つ。`Prop` を返す定義なので、真偽を計算する関数ではなく命題に名前を付けている。"""),
E("b6", "帰納型: 関数の結果（Out）",
r"""次のどちらか。

- `ok beg len`: `Qtrue` を返し、`*begp` と `*lenp` に beg と len が入る
- `out`: `Qnil` を返す（C の `goto out_of_range`）"""),
E("b7", "帰納型: 実装モデルの結果（ChkOut）",
r"""`Out` の 2 つに、`overflow`（符号付きオーバーフローに当たった）を加えたもの。オーバーフローを検出するモデルの結果に使う。"""),
E("b8", "定義: Out を ChkOut に埋め込む",
r"""`ok b l` は `ok b l` に、`out` は `out` に対応させる。仕様 S（`Out` を返す）と実装モデル（`ChkOut` を返す）を比べるために使う。"""),
]

CASES = [
E("b1", "モジュール説明: 具体的な入力",
r"""既知の正解、証明、非空性の確認（命題の前提が満たされる入力が実際にあること）で使う具体的な入力。"""),
E("b3", "定義: caseEndMax（`[1,2][0..LONG_MAX]`）",
r"""$b = 0,\ e = \mathrm{MAX}$、終点を含む、$n = 2,\ err = 0$。Ruby の `[1,2][0..LONG_MAX]` にあたる。"""),
E("b4", "定義: caseDouble（2 回折り返す例）",
r"""$b = -1,\ e = \mathrm{MAX}$、終点を含む、$n = 2,\ err = 1$。範囲 `-1..LONG_MAX` を err = 1（`values_at` など）で使う場合で、64 ビットの折り返しが 2 回起きる。"""),
E("b5", "定義: caseNormal（普通の読み出し）",
r"""$b = 0,\ e = 1$、終点を含む、$n = 2,\ err = 0$。`[1,2][0..1]` にあたる、オーバーフローのない普通の読み出し。"""),
E("b6", "定義: caseO2（O2 の例）",
r"""$b = \mathrm{MAX},\ e = \mathrm{MIN}$、終点を含む、$n = 2,\ err = 1$。範囲 `LONG_MAX..LONG_MIN` で、オーバーフロー条件 O2 に当たる。"""),
]

SPEC = [
E("b1", "モジュール説明: 仕様 S",
r"""数学的な整数の上で定義した仕様で、C コードの文の順序には依らない。文章による説明は `PROPERTIES.md` にある。"""),
E("b3", "定義: 正規化した始点 B",
r"""$b_0$ を始点（`nil` なら 0）として
$$B = \begin{cases} b_0 + n & (b_0 < 0) \\ b_0 & (b_0 \ge 0) \end{cases}$$
負の値は末尾から数える。"""),
E("b4", "定義: 正規化した終点 E（含まない側）",
r"""終点が `nil`（終わりのない範囲）なら $E = n$。そうでなければ、終点 e を $e' = e + n$（$e < 0$ のとき）または $e' = e$ と正規化し、
$$E = e' + \begin{cases} 0 & (\text{終点を含まない}) \\ 1 & (\text{終点を含む}) \end{cases}$$
つまり E は「最後の添字の 1 つ先」。"""),
E("b5", "定義: 仕様 S（意図される区間）",
r"""$$S(i) = \begin{cases} \mathrm{out} & (B < 0) \\ \mathrm{ok}\bigl(B,\ \max(E - B,\ 0)\bigr) & (err = 1) \\ \mathrm{out} & (n < B) \\ \mathrm{ok}\bigl(B,\ \max(\min(E, n) - B,\ 0)\bigr) & (\text{それ以外}) \end{cases}$$

- err ∈ {0, 2}: 選ばれる添字は $[B, E) \cap [0, n)$。始点が末尾より後なら範囲外。
- err = 1: 区間 $[B, E)$ を n で切り詰めない（受け手を伸ばすことがある）。

S は常にこの数学的な区間を返す。区間が `long` に収まらない場合（err = 1 で len や B + len が `LONG_MAX` を超える）にどうすべきかはモデル化しておらず、例外も出さない。表現できるかどうかは `P1_repr` と `P4` で別に調べる。""",
lean=r"""`max (E - B) 0` は長さが負にならないようにするため。比較と演算はすべて `Int`（上限のない整数）なので、ここではあふれは起きない。"""),
]

IMPL = [
E("b1", "モジュール説明: 実装モデル M_chk と M_wrap",
r"""どちらも `rb_range_component_beg_len`（range.c、ruby/ruby 1f2a4bd）を文ごとに写したモデルで、違いは `long` の加算・減算の扱いだけ。

引用している C の処理は次のとおり。

1. 始点 beg（nil なら 0）と終点 end（nil なら −1）を取り出す。終点が nil なら「終点を含まない」を偽にする
2. beg < 0 なら len を足し、それでも負なら範囲外
3. end < 0 なら len を足す
4. 終点を含むなら end を 1 増やす
5. err が 0 か 2 なら、beg > len で範囲外、end > len なら end = len に切り詰める
6. len = end − beg とし、負なら 0"""),
E("b3", "定義: 検査つきの long 演算",
r"""$$\mathrm{checked}(x) = \begin{cases} \mathrm{some}\ x & (\mathrm{MIN} \le x \le \mathrm{MAX}) \\ \mathrm{none} & (\text{それ以外 = 符号付きオーバーフロー}) \end{cases}$$"""),
E("b4", "定義: 64 ビットへの折り返し",
r"""$$\mathrm{wrap64}(x) = \bigl((x - \mathrm{MIN}) \bmod 2^{64}\bigr) + \mathrm{MIN}$$
2 の補数で 64 ビットに折り返した値。結果は常に $[\mathrm{MIN}, \mathrm{MAX}]$ に入る。""",
lean=r"""`%` は `Int.emod` で、除数が正なら結果は 0 以上。そのため和は $\mathrm{MIN}$ 以上 $\mathrm{MAX}$ 以下になる。"""),
E("b5", "定義: 関数本体（演算の扱いを引数にしたもの）",
r"""arith は `long` の加算・減算の結果を与える関数（`none` はオーバーフロー）。入力 i に対して次の順に計算する。

1. $b_0$ = 始点（nil なら 0）、$e_0$ = 終点（nil なら −1）。終点が nil なら「終点を含まない」を偽にする。
2. $b_0 < 0$ なら $\mathit{beg} = \mathrm{arith}(b_0 + n)$、そうでなければ $\mathit{beg} = b_0$。$\mathit{beg} < 0$ なら `out`。
3. $e_0 < 0$ なら $e_1 = \mathrm{arith}(e_0 + n)$、そうでなければ $e_1 = e_0$。
4. 終点を含むなら $e_2 = \mathrm{arith}(e_1 + 1)$、そうでなければ $e_2 = e_1$。
5. err ∈ {0, 2} なら、$n < \mathit{beg}$ で `out`、$e_2 > n$ なら $e_3 = n$（それ以外は $e_3 = e_2$）。
6. $l = \mathrm{arith}(e_3 - \mathit{beg})$ とし、結果は $\mathrm{ok}(\mathit{beg},\ \max(l, 0))$。

途中のどこかで arith が `none` を返したら、結果は `overflow`。""",
lean=r"""`match … with | none => … | some x => …` で各演算の結果を場合分けしている。`i.b.getD 0` は Option から値を取り出し、`none` なら 0 を使う。`clip && i.n < beg` の `&&` は Bool の「かつ」。""",
src=r"""`--` のコメントは、そこで写している range.c の文。モジュール説明に引用した `rb_range_component_beg_len` の本体と 1 文ずつ対応する。"""),
E("b6", "定義: M_chk（検査つき）",
r"""$M_{chk}(i) = \mathrm{body}(\mathrm{checked}, i)$。すべての `long` 演算を検査し、$[\mathrm{MIN}, \mathrm{MAX}]$ を外れたら `overflow` を返す。C の意味に対して安全側（保守的）なモデル。"""),
E("b7", "定義: M_wrap（64 ビット折り返し）",
r"""$M_{wrap}(i) = \mathrm{body}(x \mapsto \mathrm{some}(\mathrm{wrap64}(x)), i)$。すべての `long` 演算を $2^{64}$ を法として折り返す。`overflow` を返すことはない。""",
lean=r"""生成されたコードと一致するのは `-fno-strict-overflow` が有効なときだけ（CRuby の configure が付ける。gcc 13 と clang 18 で確認）。付いていなければ符号付きオーバーフローは未定義動作で、このモデルは当てはまらない。"""),
]

STATEMENTS = [
E("b1", "モジュール説明: 命題 P1〜P4（主張だけ）",
r"""ここにあるのは定理ではなく `Prop` の定義で、何を証明・反証するのかを正確に述べたもの。証明は `CrubyRange/Proofs.lean` にある。算術と比較はすべて `Int` の上で行う（折り返しなし）。"""),
E("b3", "見出し: P1 仕様との一致（主目標）"),
E("b4", "命題 P1: M_chk はオーバーフローしない限り S と一致する",
r"""$$\forall i,\quad \mathrm{Valid}(i) \;\wedge\; M_{chk}(i) \ne \mathrm{overflow} \;\Longrightarrow\; M_{chk}(i) = S(i)$$""",
lean=r"""右辺の `(spec i).toChk` は、S の結果（`Out`）を `ChkOut` に埋め込んだもの。"""),
E("b5", "命題 P1_repr: err ∈ {0, 2} なら S の結果は long に収まる",
r"""$$\forall i,\quad \mathrm{Valid}(i) \wedge err \ne 1 \wedge S(i) = \mathrm{ok}(b, l) \;\Longrightarrow\; \mathrm{MIN} \le b \le \mathrm{MAX} \;\wedge\; \mathrm{MIN} \le l \le \mathrm{MAX}$$"""),
E("b6", "見出し: P3 演算の安全性（主目標）"),
E("b7", "定義: オーバーフロー条件 O1",
r"""$$O_1(i) :\iff 0 \le B \;\wedge\; e = \mathrm{MAX} \;\wedge\; \text{終点を含む}$$
終点が `LONG_MAX` の範囲で `end++` があふれる場合。""",
src=r"""range.c:1925 の `end++`。"""),
E("b8", "定義: オーバーフロー条件 O2（err = 1 のときだけ）",
r"""$$O_2(i) :\iff err = 1 \;\wedge\; 0 \le B \;\wedge\; E - B < \mathrm{MIN}$$
`end - beg` が `LONG_MIN` を下回る場合。""",
src=r"""range.c:1932 の `end - beg`。"""),
E("b9", "命題 P3: M_chk がオーバーフローするのは、ちょうど O1 か O2 のとき",
r"""$$\forall i,\quad \mathrm{Valid}(i) \;\Longrightarrow\; \bigl(M_{chk}(i) = \mathrm{overflow} \iff O_1(i) \vee O_2(i)\bigr)$$
同値なので、O1・O2 以外ではあふれないことと、O1・O2 では必ずあふれることの両方を述べている。"""),
E("b10", "系 P3_safe: よくある使い方ではオーバーフローしない",
r"""$$\forall i,\quad \mathrm{Valid}(i) \wedge err \ne 1 \wedge (e \ne \mathrm{MAX} \vee \text{終点を含まない}) \;\Longrightarrow\; M_{chk}(i) \ne \mathrm{overflow}$$
err ∈ {0, 2} では、終点を含まない範囲か、終点が `LONG_MAX` 以外の範囲なら、あふれない。"""),
E("b11", "見出し: P2 上限での飽和性（要素の読み出しのみ）"),
E("b12", "命題 P2(f): モデル f は上限で飽和する",
r"""$$\forall i,\quad \mathrm{Valid}(i) \wedge err = 0 \wedge \text{終点を含む} \wedge e = e_0 \wedge n - 1 \le e_0 \;\Longrightarrow\; f(i) = f(i[e := \mathrm{nil}])$$
終点が最後の添字以降にある「終点を含む範囲」の結果は、終わりのない範囲（`b..`）の結果と同じになる、という性質。""",
lean=r"""`{ i with e := none }` は、i の終点だけを `nil` に替えた入力。任意のモデル f について述べた命題で、S では成り立ち、M_wrap では `e = LONG_MAX` のとき破れる見込み、とコメントにある。"""),
E("b13", "見出し: P4 出力の契約（呼び出し側が頼っていることの調査つき）"),
E("b14", "定義: ok の結果に課す契約の候補",
r"""結果が $\mathrm{ok}(\mathit{beg}, \mathit{len})$ のとき
$$0 \le \mathit{beg} \;\wedge\; 0 \le \mathit{len} \;\wedge\; \begin{cases} \mathit{beg} + \mathit{len} \le \mathrm{MAX} & (err = 1) \\ \mathit{beg} \le n \;\wedge\; \mathit{beg} + \mathit{len} \le n & (\text{それ以外}) \end{cases}$$
`out` と `overflow` には何も課さない。""",
lean=r"""和は `Int` で計算するので、契約の式そのものはあふれない。`| _ => True` は「それ以外の場合は無条件に成り立つ」。"""),
E("b15", "命題 P4(f): モデル f は契約を満たす",
r"""$$\forall i,\quad \mathrm{Valid}(i) \;\Longrightarrow\; \mathrm{Contract}\bigl(i, f(i)\bigr)$$"""),
]

FIXED = [
E("b1", "モジュール説明: 検証する修正（ruby/ruby#19824）",
r"""`patches/range-beg-len-overflow.patch`（gotoken/ruby の `fix-range-beg-len-overflow` の commit d4d80a35。#19824 の先頭）は、`rb_range_component_beg_len` の 2 つの文を変える。

- 終点を含むとき、`end < RB_LEN_MAX` の場合だけ `end++` する。`RB_LEN_MAX + 1` は表せないので、あふれさせずに飽和させる
- `len = end > beg ? end - beg : 0;` にする。ここでは beg が非負なので、`end - beg` はあふれない

さらに「成功したとき `*begp` と `*lenp` は非負で、その和は `RB_LEN_MAX` を超えない」と文書化する（`FixedProofs.lean` の `fix_doc_contract`）。`bodyFixed` は `body` にちょうどこの 2 点の変更を加えたもの。"""),
E("b3", "定義: 修正後の関数本体",
r"""`body` との違いは次の 2 点だけ。

1. 終点を含むとき、$e_1 \ge \mathrm{MAX}$ なら $e_2 = e_1$（飽和）、そうでなければ $e_2 = \mathrm{arith}(e_1 + 1)$。
2. $\mathit{beg} < e_3$ のときだけ $\mathit{len} = \mathrm{arith}(e_3 - \mathit{beg})$、そうでなければ $\mathit{len} = 0$。

ほかの手順（始点・終点の正規化、err ∈ {0, 2} での切り詰め）は `body` と同じ。""",
lean=r"""`decide (MAX ≤ end1)` は命題を Bool に変えて if の条件に使っている。`excl || …` の `||` は Bool の「または」。"""),
E("b4", "定義: 修正後の M_chk",
r"""$M_{chk}^{fixed}(i) = \mathrm{bodyFixed}(\mathrm{checked}, i)$。修正後の本体を検査つきの演算で動かすモデル。"""),
E("b5", "定義: 修正後の M_wrap",
r"""$M_{wrap}^{fixed}(i) = \mathrm{bodyFixed}(x \mapsto \mathrm{some}(\mathrm{wrap64}(x)), i)$。修正後の本体を 64 ビットの折り返しで動かすモデル。GCC でビルドしたものが実際に実行する動作にあたる。"""),
E("b6", "定義: specSat（終点を LONG_MAX で打ち切った S）",
r"""$E' = \min(E, \mathrm{MAX})$ として、S と同じ式で
$$\mathrm{specSat}(i) = \begin{cases} \mathrm{out} & (B < 0) \\ \mathrm{ok}\bigl(B,\ \max(E' - B,\ 0)\bigr) & (err = 1) \\ \mathrm{out} & (n < B) \\ \mathrm{ok}\bigl(B,\ \max(\min(E', n) - B,\ 0)\bigr) & (\text{それ以外}) \end{cases}$$
S と違うのは err = 1 で O1 に当たる入力だけ。そこでは S の終点 `LONG_MAX + 1` が `long` で表せない。"""),
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
