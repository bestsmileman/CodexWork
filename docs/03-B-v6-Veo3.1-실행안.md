# 03-B v6 · Veo 3.1 1회 실행안 — **승인 대상 정본 (단일)**

작성: 젠스 2026-11-10 · **이 파일 하나가 이번 실행의 승인 대상이다.** 다른 문서의 같은 프롬프트는 참고용이며, 내용이 다르면 이 파일이 이긴다.
상태: **미승인 제안.** 아주 명시 승인 전 제출·생성 없음. 코호 검토 = 보류(9437262), 반영 후 재확인 대기.
생성 0회 · 차감 0(견적 dry-run만).

## 0. 고정 대상

| 항목 | 값 |
|---|---|
| 승인 대상 파일 | `docs/03-B-v6-Veo3.1-실행안.md` (이 파일) |
| 승인 대상 절 | **3절 프롬프트 코드블록 전문** |
| 프롬프트 지문 | sha256 `76adf702e1e74203f08550e8b83af8a312b5f1f80feabbf52e97da845c093078` · 1065자 |
| 지문 계산법 | 3문단을 개행 1개로 이은 UTF-8 문자열, 끝 개행 없음 |
| 커밋 | 이 문서를 올린 커밋 해시를 스레드에 함께 적는다(자기 해시는 파일 안에 못 씀) |

## 1. 사양 (요청값 고정)

| 항목 | 값 |
|---|---|
| 모델 | `gemini/veo3.1` (Gemini Veo 3.1) |
| 티어 | 미지정 = 모델 기본(standard 계열) |
| 길이 | 6초 (Veo 3.1 지원: 4/6/8초 — **5초 없음**) |
| 비율·해상도 | 9:16 · **1080p** |
| 오디오 | `audio_enable=true` — 생활음 |
| 시작 이미지 | `assets/03B_start_face_v2_hair.jpg` (v5 통과 스틸) |
| 횟수 | **1회**, 자동 재시도 없음 |
| 견적 | **924**(dry-run 실측) · 제안 상한 **950** |

### 1-1. 시작 프레임으로 물리는 근거 (`gsk video --help`, 2026-11-10 조회)

> `gemini/veo3.1`: "Supports text-to-video and image-to-video generation… **image_urls are frames unless reference_mode: 1 image = first frame**, exactly 2 = first/last frame transition, 3 (or reference_mode=true) = style/character references (max 3, 8s only)."

→ `-i` 1장 + `reference_mode` 없음 = **첫 프레임(i2v)**. 참조 모드 아님.
같은 도움말의 `--audio_enable`: "Omit to keep each model's default (kling: off; **seedance/veo: on**)" → 오디오 기본 on, 이번엔 명시 true.

### 1-2. 견적 응답 원문 (2026-11-10T12:26Z, 과금 0)

같은 플래그 조합으로 `--estimate true` 실행:

```json
{"estimate":true,"model":"gemini/veo3.1","display_name":"Gemini Veo 3.1","duration":6,"aspect_ratio":"9:16","resolution":"1080p","tier":null,"audio_enable":true,"draft":false,"estimated_credits":924,"note":"Dry run: nothing was generated or billed. The figure is approximate; the bill settles on the finished clip."}
```

정확히 이 설정(Veo 3.1 · 6초 · 1080p · 9:16 · 시작 이미지 1장 · 오디오 on)의 응답이며, **드라이런이라 생성·과금 없음**. `tier:null` = 티어 미지정, `draft:false`.

### 1-3. 잔액 (같은 조회 시점)

- 충전: **7,500** 추가, 2026-11-10T12:15:51Z, 유효기간 2027-02-10 (status active) — 도구 응답 원문 기준.
- 현재 가용: **7,438** (`gsk account credit`, 이 문서 작성 시점).
- **정정**: 앞서 말한 "7,500−7,465=35, 그 사이 대화 비용"은 **충전액만 비교한 값**이라 철회한다. 충전 직전 잔액 243이 같은 지갑에 남아 있었다면 기대값은 7,743이고 차이는 **278**이 된다. 시점·만료·지갑 구분 없이 어느 쪽도 확정하지 않는다. 확인된 사실은 위 두 숫자(충전 7,500 · 현재 7,438)뿐이다.

## 2. 시선·머리 (문구 통일 결과)

| 항목 | 처리 |
|---|---|
| 시작 시선 | 아래 작업 지점 — 참조 이미지와 같은 방향 |
| 상승 목표 | **지금 내려보는 방향과 같은 화면 쪽**을 유지한 채, **렌즈 축 밖 정희 방향의 한 고정점**으로 **조금** 올린다 |
| 좌/우 단어 | 쓰지 않는다 — 스틸 한 장으로 좌우를 확정할 근거 없음(0dae982 철회) |
| 높이 | **단정하지 않는다** — '정희 얼굴이 눈높이 위'도, '자기 눈높이'도 쓰지 않는다 |
| 머리 | 초기 각도 유지, 추가 기울임·끄덕임·돌림 없음 |
| 깜박임·호흡 | 별도 과제 아님(눈에 띄지 않을 만큼만) |

영어 원문에서 뺀 것: `across from him`(상대 위치 단정), `at his own eye level`(높이 단정), 화면 좌/우 지시, 각도 수치(5~10°, 3~5°).

## 3. 프롬프트 — **승인 대상 전문**

```text
Fixed camera, medium close shot, quiet Korean home kitchen. The man from the reference image fills the frame from the chest up, grey work shirt with a chest pocket, short apron tied at the front, a folded dish towel in one hand, warm daylight from a side window.
He begins looking down at the work below frame, in the same direction as the reference image. Staying on the same side of the frame as that downward look, his eyes lift a little to one fixed point in the direction of the other person in the room — a point clearly off the camera axis, not the lens. He does not look at the camera. His expression softens into a faint, closed-mouth smile and settles there. He maintains the initial head angle, with no additional tilt, nod or turn. Breathing and blinking stay unobtrusive and natural.
Realistic skin texture, soft shadows, shelves and stainless steel softly out of focus behind him, his face sharp and readable. Only quiet domestic sound: faint room tone, soft cloth, ceramic. No speech, no voice-over, no music, no captions, no on-screen text or logos.
```

## 4. 연출 박자 (6초 생성 / 편집 최대 5초 사용)

| 구간(근사) | 내용 |
|---|---|
| 앞 약 1.5초 | 아래 작업 지점을 본다 |
| 중간 약 2.5초 | 눈이 조금 올라가며 작은 미소가 시작된다 |
| 마지막 약 2초 | 그 미소를 유지한다 |

**생성 6초 ≠ 편집 5초.** 33초 조립 길이는 바뀌지 않는다. 프레임 단위 일치를 요구하지 않는다.

## 5. 검수 (2층 — 코호 연속 재생)

**5-A 기본 오류 먼저** — 손·행주 복제/소실, 소매·앞치마·행주 일관성, 머리 추가 기울임, 끊김·급가속, 말소리·음악·캡션·로고, 인물 동일성, 화면 글자. 하나라도 실패면 미달로 기록하고 감정 판정으로 넘어가지 않는다.
**5-B 감정 3항목** — ① 시선이 렌즈 축을 벗어난 고정점을 향함(카메라 미소면 미달) ② 입 다문 작은 미소 ③ 눈가 먼저 → 입가 순서의 한 번 반응. 셋 다 만족해야 채택.

미달이면 **재생성 없이 중단**하고 다음 선택지를 새로 승인받는다.

## 6. 성공 후에도 — 본제작 자동 진입 없음

1. 이 클립 **1개**를 연속 재생·음향·기본 오류·감정 표현으로 검수한다(코호).
2. **아주 평가**를 받는다.
3. 그 평가 뒤에 **다음 범위(본제작 7숏·해상도·재생성 여유)를 새로 승인**받는다.

- Kling 비교는 이번 결과에 따라 **생략 가능** — 단 본제작의 새 승인은 생략하지 않는다.
- 1080p 상승이 표정 개선을 보장하지 않는다. 이번 시험은 "이 조건에서 표현이 채택 기준을 넘는가"만 본다.
- 두 모델 모두 미달이면 "이번 조건에서 채택 기준 미달, 원인 미확정"으로 기록한다.

## 7. 승인표

| 사람 | 상태 |
|---|---|
| 젠스 | 제안(이 문서) |
| 코호 | **검토 보류** (9437262) → 이 개정본 재확인 필요 |
| 아주 | **이번 실행 승인 미확인** |

**아주가 이 문서 3절 전문에 대해 명시 승인하기 전에는 제출하지 않는다.** 충전은 생성 승인이 아니다.
