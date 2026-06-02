# Memory Map (날짜별 추억 지도)

다녀온 장소를 날짜별로 기록하고, 같은 날의 장소들을 연결해 그날의 추억을 다시 보는 모바일 앱입니다.

## v1 핵심 기능 (이 3가지에만 집중)
1. 장소 기록: 지도에 다녀온 장소를 핀으로 저장
2. 같은 날 연결: 같은 날짜에 기록한 장소들을 묶어서 보기
3. 날짜·핀 회상: 날짜나 핀으로 그날의 추억을 다시 보기

## 기술 스택 (고정)
- 앱: Expo (React Native) + TypeScript
- 지도: react-native-maps
- 국내 장소 검색: 카카오 로컬 REST API
- 데이터 저장: Supabase
- 빌드/배포: EAS

자세한 작업 규칙은 [.cursorrules](.cursorrules) 파일을 참고하세요.

---

## 깃허브 작업 방식 (GitHub Flow)

혼자 개발하더라도 "실무에서 쓰는 안전한 방식"으로 작업합니다. 핵심은 **main 브랜치는 항상 정상 동작하는 상태로 유지**하고, 새 작업은 별도 브랜치에서 한 뒤 합치는 것입니다.

### 기본 원칙
- `main` 브랜치 = 언제나 잘 돌아가는 "완성본". 여기에 직접 막 작업하지 않습니다.
- 새 기능/수정은 항상 새 브랜치를 만들어서 작업합니다.
- 한 번에 한 기능만 작업합니다.
- 작업이 끝나면 GitHub에서 Pull Request(PR)로 main에 합칩니다.

### 브랜치 이름 규칙
- 새 기능: `feat/기능이름`  (예: `feat/place-pin`)
- 버그 수정: `fix/문제이름`  (예: `fix/map-crash`)
- 설정/문서: `chore/내용`  (예: `chore/setup`)

### 단계별 흐름
한 기능을 만들 때 아래 순서를 반복합니다.

```bash
# 1. main을 최신 상태로
git checkout main
git pull

# 2. 새 작업 브랜치 만들기
git checkout -b feat/기능이름

# 3. 작업 후 커밋 + 바로 푸시 (항상 같이)
git add .
git commit -m "feat: 무엇을 했는지 한 줄 설명"
git push -u origin feat/기능이름

# 4. GitHub 사이트에서 Pull Request 만들고 내용 확인 후 "Merge"
# 5. 합친 뒤 브랜치 정리
git checkout main
git pull
```

### 커밋 메시지 규칙 (간단 버전)
- `feat:` 새 기능 추가
- `fix:` 버그 수정
- `chore:` 설정/잡일
- `docs:` 문서 수정

예) `feat: 지도에 장소 핀 저장 기능 추가`

### 약속
- **커밋할 때는 항상 푸시도 같이 합니다.** (작업물을 깃허브에 바로 백업)
- 한 단계가 정상 동작하는 걸 확인하면 커밋합니다.
- API 키 같은 비밀값은 절대 커밋하지 않습니다. (`.env`에만 보관)
