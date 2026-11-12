# Taiyak

[English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · **한국어** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

Lean 4 소스를 선언 단위로 나누고, 각 선언 옆에 선택한 자연어로 쓴 수학적 번역을 나란히 보여 주는 브라우저입니다. 소스를 읽기만 하므로 Lean 빌드는 필요 없습니다. 이름은 원문과 번역을 나란히 놓은 글을 뜻하는 일본어 '対訳'(taiyaku)에서 따왔습니다.

**웹 버전: <https://taiyak.pages.dev/>**

![데모의 Impl.lean을 Lean 코드와 번역을 나란히 표시한 화면](screenshot.png)

## 기능

- GitHub URL(비공개 저장소도 가능), ZIP 파일, 폴더에서 Lean 4 저장소를 연다
- 선언(`def`, `theorem`, `structure` 등)마다 Lean 코드와 번역을 나란히 보여 준다. 일본어, 영어, 중국어(간체·번체), 한국어, 프랑스어, 독일어, 스페인어, 포르투갈어, 러시아어 중에서 고를 수 있고, 다른 언어를 직접 입력할 수도 있다
- 언어 선택 하나로 번역, 화면 문구, 용어 설명, 'Claude에게 묻기'의 설명이 모두 그 언어가 된다. 화면 문구는 위의 10개 언어가 내장되어 있다(그 밖의 언어는 영어). 용어 설명은 일본어와 영어가 내장되어 있고, 다른 언어는 처음 선택할 때 Claude가 번역해 브라우저에 저장한다(누른 단어를 먼저 번역하고, 나머지는 백그라운드에서 진행하며 진행 상황을 표시). 설정에서 화면 언어만 따로 고정할 수도 있다
- 처음 열 때는 브라우저의 선호 언어에서 일본어가 영어보다 앞에 있으면 일본어로, 그렇지 않으면 영어로 표시한다
- 번역할 때, 현재 파일이 참조하는 것 중 import한 파일에 정의된 것을 문맥으로 함께 보낸다
- 식별자를 탭하면 정의 요약을 보여 주고 정의 위치로 이동할 수 있다. `∀`, `omega`, `rcases` 같은 기호와 전술(tactic)에는 짧은 설명이 나온다
- 긴 증명은 처음에 접힌 상태로 표시한다
- 번역은 브라우저에 저장한다. 내보내서 저장소에 커밋해 두면, 그 저장소를 연 사람은 API 키 없이 번역을 읽을 수 있다
- 특정 파일이나 선언을 바로 여는 공유 링크를 만들 수 있다

## 사용법

### 웹 버전 (Cloudflare Pages)

<https://taiyak.pages.dev/>를 엽니다.

1. GitHub URL을 입력하고 '열기'를 누른다
2. '설정'에서 Anthropic, OpenAI, Google 중 하나의 API 키를 입력한다(번역에 필요). 비공개 저장소라면 GitHub 토큰도 입력한다. 설정의 'GitHub에서 토큰 만들기'를 누르면 읽기 전용(Contents: read)과 30일 만료가 미리 입력된 GitHub 토큰 생성 화면이 열리므로, 읽고 싶은 저장소를 골라 만들기만 하면 된다
3. '이 파일 번역' 또는 각 블록의 '번역'을 누른다

URL 없이 열면 데모가 표시됩니다. CRuby `range.c`의 `rb_range_component_beg_len`(범위 인수의 정규화)을 Lean으로 옮긴 모델과, 그 명세, 성질 P1–P4, 수정판 모델입니다. 작성자의 비공개 실험 저장소 `gotoken/cruby-formalized-trial` @74e11c6에서 가져왔습니다. `Basic`, `Cases`, `Spec`, `Impl`, `Statements`, `Fixed`에는 영어와 일본어 번역이 들어 있고, 다른 파일은 그 자리에서 번역할 수 있습니다.

### claude.ai 버전

`dist/claude-artifact.html`을 claude.ai 아티팩트로 게시하면, 보는 사람 각자의 Claude 계정으로 번역합니다(API 키 불필요). 다만 claude.ai 안의 페이지에서는 GitHub에 연결할 수 없으므로, GitHub의 'Code → Download ZIP'으로 받은 ZIP을 'ZIP 열기'로 불러옵니다.

### 공유 링크

웹 버전에서 GitHub 저장소를 열고 있는 동안에는 주소창의 URL이 그대로 공유 링크입니다. 각 블록 오른쪽 위의 줄 번호(`L16–17` 등)를 누르면 그 선언으로 가는 링크가 복사됩니다.

| 매개변수 | 의미 |
|---|---|
| `repo` | `owner/repo` |
| `ref` | 브랜치, 태그, 커밋(생략하면 기본 브랜치) |
| `path` | 열 파일 |
| `decl` | 스크롤할 선언 이름(이름 없는 블록은 `id=b12` 형식) |
| `lang` | 번역 언어 |

예: <https://taiyak.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=%ED%95%9C%EA%B5%AD%EC%96%B4>

### 번역을 저장소에 함께 넣기

1. 원하는 파일을 번역한다
2. '설정' → '번역 내보내기'로 JSON 파일을 얻는다(지금 열려 있는 저장소의 것만 나온다)
3. 대상 저장소에 `.taiyak/ko.json`으로 커밋한다(언어마다 파일 하나, 이름은 자유)

저장소를 열면 `.taiyak/*.json`을 자동으로 읽습니다. 같은 블록에 직접 만든 번역이 있으면 그쪽이 우선합니다. 번역은 '언어, 자세히 수준, 파일 경로와 블록 본문의 해시'로 대조하므로, 블록의 코드가 바뀌면 예전 번역은 더 이상 쓰이지 않습니다.

## 키와 데이터

- API 키와 GitHub 토큰은 브라우저 안에서만 사용합니다. '이 브라우저에 저장'을 선택했을 때만 localStorage에 저장합니다. 공용 컴퓨터에서는 저장하지 마세요.
- 페이지가 통신하는 곳은 `api.github.com`, `api.anthropic.com`, `api.openai.com`과 `generativelanguage.googleapis.com`뿐입니다. 웹 버전에서는 `public/_headers`의 Content-Security-Policy로 이를 강제하므로, 브라우저는 그 밖의 곳으로 보내는 것을 거부합니다. 인라인 스크립트도 해시로 고정되어 있습니다.
- 번역할 때 대상 파일과 그 파일이 참조하는 정의의 Lean 소스를 선택한 API(Anthropic, OpenAI, Google 중 하나)에 보냅니다. 비공개 코드를 번역할 때는 소속 조직의 방침을 확인하세요.
- GitHub 토큰은 fine-grained personal access token을 권장합니다. 필요한 저장소만 선택하고 권한은 Contents: Read-only로 하세요.

## 동작 방식과 한계

- 분할은 최상위 키워드와, 텍스트가 주석이나 문자열 안에 있는지를 보는 정적인 처리입니다. Lean을 실행하지 않으므로 타입 정보, 표기법과 매크로의 전개, 전술 증명 도중의 목표는 사용하지 않습니다.
- 문맥은 import를 최대 3단계, 30개 파일까지 따라가며 이름이 일치하는 정의를 모읍니다. 같은 이름의 정의가 너무 많은 짧은 이름은 제외합니다.
- 번역은 LLM이 만든 것이므로 틀릴 수 있습니다. 코드와 대조하며 읽으세요.
- `mutual` 블록 안의 선언이나 매크로가 생성하는 선언은 제대로 분할되지 않을 수 있습니다.

## 개발

```sh
python3 tools/build.py             # src/와 demo/에서 public/과 dist/를 생성
node --test "test/*.test.cjs"      # 분할, 문맥 수집, 응답 해석 테스트
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js(분할 등 DOM을 쓰지 않는 부분), app.js(UI),
            i18n.js(언어와 화면 문구), glossary.js(기호 사전)
demo/       데모용 Lean 파일, 그 영어·일본어 번역, CRuby의 BSDL
vendor/     KaTeX, JSZip(MIT)
tools/      build.py, 데모 번역의 소스
test/       node:test 테스트
docs/       이 README의 번역본, 스크린샷
public/     웹 버전(빌드 결과. Cloudflare Pages가 이 디렉터리를 배포)
dist/       claude.ai 버전(빌드 결과. 파일 하나)
```

`src/`나 `demo/`를 바꾸면 `tools/build.py`를 실행하고 `public/`과 `dist/`도 함께 커밋하세요. CI가 빌드 결과와 소스가 일치하는지 확인합니다. 배포되는 내용을 저장소에서 그대로 읽을 수 있도록 빌드된 파일을 두고 있습니다.

## Cloudflare Pages에 배포하기

1. Cloudflare 대시보드에서 Workers & Pages → Create → Pages → Connect to Git을 선택하고 이 저장소를 지정한다
2. Framework preset은 None, Build command는 비워 두고, Build output directory는 `public`
3. 저장하면 `main`에 push할 때마다 배포된다

`public/_headers`의 보안 헤더도 함께 적용됩니다.

## 라이선스

- 저장소 전체(데모의 Lean 파일 포함): BSD 2-Clause License(`LICENSE`)
- 데모의 `Impl.lean`과 `Fixed.lean`은 CRuby의 `range.c`(Copyright (C) 1993-2007 Yukihiro Matsumoto)와 ruby/ruby#19824의 패치를 짧게 인용합니다. CRuby는 2-clause BSDL 또는 Ruby License로 재배포할 수 있으며, 인용 부분은 BSDL로 사용합니다(`demo/CRuby-BSDL.txt`)
- `vendor/`: KaTeX와 JSZip(둘 다 MIT)

자세한 내용은 `NOTICE`를 보세요.

이 파일은 [README.md](../README.md)(영어)의 번역본입니다. 내용이 다르면 영어판이 우선합니다.
