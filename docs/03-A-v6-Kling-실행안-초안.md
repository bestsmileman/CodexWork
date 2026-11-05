> **폐기 — 개정판 `docs/03-B-v6-모델비교-실행안.md`로 대체(2026-11-05).** 이 초안의 462 견적·상한 480·'손 해결됨'·'1회로 원인 가른다'·462+616 산술은 모두 오류 또는 철회. 생성 0회.

# 실행안 v6 (초안) — Kling v3 Pro로 지우 얼굴 5초 1회

작성: 젠스 (2026-11-05) · 상태: **초안 — 코호 검토 전, 아주 승인 전. 생성 0회.**
목적: v5(Seedance 720p) 결과가 "작품 수준 아님" 판정을 받아, **모델을 바꾸면 해결되는지**를 1회로 가른다.

## 1. 왜 Kling인가

- 문제는 두 가지였다: 손 동작(해결됨 — 이번 편집에서 손 제외)과 **지우 얼굴 연기**(시선이 카메라로, 미소 과함).
- 남은 변수는 모델 품질이다. Seedance 2.0 standard 720p는 중간급이고, Kling v3 Pro는 인물 표정·시선 연기에서 상위 평가를 받는 모델이다.
- Veo 3.1(616)도 후보지만, 잔액(1,359)에서 두 모델을 다 돌릴 수 없다. **싼 쪽(462)부터** 간다.

## 2. 사양

| 항목 | 값 |
|---|---|
| 모델 | `kling/v3` · tier **pro** |
| 길이·비율 | 5초 · 9:16 |
| 해상도 | 720p (모델 기본) |
| 오디오 | `audio_enable=true` (생활음) |
| 참조 | `assets/03B_start_face_v2_hair.jpg` (v5에서 통과한 스틸, 1장 = 첫 프레임) |
| 횟수 | **1회**. 재시도 없음 |
| 견적 | **462** (2026-11-05 dry-run) |
| 상한 | **480** |

## 3. 프롬프트 (v5와 동일한 연출, 모델만 교체)

```text
Fixed camera, medium close shot, quiet Korean home kitchen. The man from the reference image fills the frame from the chest up, grey work shirt with a chest pocket, short apron tied at the front, a folded dish towel in one hand, warm daylight from a side window. He starts with his eyes lowered toward a bowl just below the frame, watching someone's hands work. He slowly lifts his gaze and looks at the person across from him — not at the camera — and his expression warms into a small, satisfied smile: the eyes soften first, then the mouth. One natural blink, one visible breath, a very slight head tilt. The smile stays small and private, never a staged grin. Realistic skin texture, soft shadows, shelves and stainless steel softly out of focus. Only quiet domestic sound: room tone, soft cloth, ceramic. No speech, no music, no captions, no logos.
```

v5와 다른 점은 한 줄뿐: **"not at the camera"** 를 명시해 시선이 렌즈로 가는 문제를 직접 막는다.

## 4. 판정 기준 (사전 합의)

통과 조건 — 아래 3개를 **모두** 만족:
1. 시선이 카메라가 아니라 화면 밖 인물(정희) 쪽으로 향한다.
2. 미소가 작고 사적인 정도로 유지된다(과장된 활짝 웃음 아님).
3. 인물 일관성 — 참조 스틸과 같은 사람으로 읽힌다(얼굴형·머리·복장).

미달이면 **재생성 없이 중단**하고, 다음 선택지(Veo 3.1 616 / 연출 재설계)를 다시 승인받는다.

## 5. 비용·잔액

| 항목 | 값 |
|---|---|
| 이번 1회 | 462 |
| 상한 | 480 |
| 현재 잔액 | 1,359 (2026-11-05 21:37Z) |
| 실행 후 예상 | 약 880~900 |

## 6. 승인표

| 사람 | 판단 |
|---|---|
| 젠스 | 동의 (실행 담당) |
| 코호 | **검토 대기** |
| 아주 | **대기** |

## 7. 이 계획이 아닌 것

- Seedance 재생성 승인이 아니다.
- Veo 3.1·Vidu 등 다른 모델 동시 테스트가 아니다.
- 손 동작 복원이 아니다(이번 편집에서 손 제외 유지).
