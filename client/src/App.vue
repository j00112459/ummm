<template>
  <div class="page-wrap">
    <!-- 첫 화면 -->
    <div v-if="!loading && !result && !errorMessage" class="card main-card">
      <div class="doodle-title">
        <span class="icon-title">🍽️</span>
        <h1>오머먹?<br /></h1>
      </div>
      <p class="subtitle">
        고민은 제가 할 거예요.<br />
        현재 위치 근처에서 골라드릴게요.
      </p>
      <div class="btn-grid">
        <button class="food-btn btn-random" @click="recommend('random')">
          <span class="btn-icon">🎲</span>
          <span class="btn-label">랜덤</span>
        </button>
        <button class="food-btn btn-soup" @click="recommend('soup')">
          <span class="btn-icon">🍲</span>
          <span class="btn-label">국물</span>
        </button>
        <button class="food-btn btn-noodle" @click="recommend('noodle')">
          <span class="btn-icon">🍜</span>
          <span class="btn-label">면</span>
        </button>
        <button class="food-btn btn-rice" @click="recommend('rice')">
          <span class="btn-icon">🍚</span>
          <span class="btn-label">밥</span>
        </button>
        <!-- 간식/야식 버튼 - 디자인 검토 후 추가 예정
        <button class="food-btn btn-snack" @click="recommend('snack')">
          <span class="btn-icon">🍢</span>
          <span class="btn-label">간식</span>
        </button>
        <button class="food-btn btn-night" @click="recommend('night')">
          <span class="btn-icon">🍗</span>
          <span class="btn-label">야식</span>
        </button>
        -->
      </div>
    </div>

    <!-- 이스터에그 화면 -->
    <div v-if="easterEgg" class="card easter-card">
      <div class="easter-icon">🥚</div>
      <p class="easter-title">이스터 에그를 발견하셨습니다!</p>
      <p class="easter-sub" v-if="easterEgg === 'meal'">개발자 밥 사주기 🍚</p>
      <p class="easter-sub" v-else>개발자 커피 사주기 ☕</p>
      <button class="reset-btn" @click="reset">다음에 살게요 🙏</button>
    </div>

    <!-- 로딩 화면 -->
    <div v-if="loading" class="card loading-card">
      <div class="loading-icon">🗺️</div>
      <p class="loading-text">근처 식당 찾는 중...</p>
      <p class="loading-sub">오늘의 {{ mealLabel }}을 고르는 중이에요.</p>
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>

    <!-- 에러 화면 -->
    <div v-if="errorMessage && !loading" class="card error-card">
      <div class="error-icon">😅</div>
      <p class="error-text">{{ errorMessage }}</p>
      <button class="reset-btn" @click="reset">다시 해보기</button>
    </div>

    <!-- 결과 화면 -->
    <div v-if="result && !loading" class="card result-card">
      <div class="result-header">
        <p class="result-eyebrow">오늘의 추천</p>
        <h2 class="result-title">오늘은 여기 어때요?</h2>
      </div>

      <div class="result-name-wrap">
        <span class="result-name">{{ result.restaurant.place_name }}</span>
      </div>

      <div class="result-tags">
        <span class="tag tag-type">{{ result.typeLabel }}</span>
        <span class="tag tag-keyword"># {{ result.keyword }}</span>
      </div>

      <div class="result-info">
        <div class="info-row">
          <span class="info-icon">📍</span>
          <span>{{
            result.restaurant.road_address_name ||
            result.restaurant.address_name
          }}</span>
        </div>
        <div class="info-row">
          <span class="info-icon">🚶</span>
          <span
            >도보 약 <strong>{{ result.walkingMinutes }}분</strong> ({{
              result.restaurant.distance
            }}m)</span
          >
        </div>
        <div class="info-row" v-if="result.restaurant.category_name">
          <span class="info-icon">🏷️</span>
          <span>{{ result.restaurant.category_name }}</span>
        </div>
      </div>

      <div class="menu-info" v-if="result.menuInfo">
        <span class="menu-label">🍴 대표 메뉴</span>
        <p class="menu-text">{{ result.menuInfo }}</p>
      </div>

      <div class="ai-bubble">
        <span class="ai-label">AI 한마디 💬</span>
        <p class="ai-text">{{ result.aiMessage }}</p>
      </div>

      <div class="result-actions">
        <a
          :href="result.restaurant.place_url"
          target="_blank"
          rel="noopener noreferrer"
          class="map-btn"
          >🗺️ 지도에서 보기</a
        >
        <button class="reset-btn" @click="reset">다시 고르기</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const loading = ref(false);
const errorMessage = ref('');
const result = ref(null);
const selectedType = ref('');
const easterEgg = ref(null);

const mealLabel = computed(() => {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return '아침';
  if (h >= 11 && h < 15) return '점심';
  if (h >= 15 && h < 17) return '간식';
  if (h >= 17 && h < 22) return '저녁';
  return '야식';
});

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저는 위치 기능을 지원하지 않아요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () =>
        reject(new Error('위치 권한을 허용해야 근처 식당을 추천할 수 있어요.')),
    );
  });
}

async function recommend(type) {
  // 3% 확률 이스터에그 (랜덤 버튼만)
  if (type === 'random' && Math.random() < 0.03) {
    easterEgg.value = Math.random() < 0.5 ? 'meal' : 'coffee';
    return;
  }

  selectedType.value = type;
  loading.value = true;
  errorMessage.value = '';
  result.value = null;

  let coords;
  try {
    coords = await getCurrentLocation();
  } catch (err) {
    loading.value = false;
    errorMessage.value = err.message;
    return;
  }

  try {
    const base = import.meta.env.VITE_API_URL || '';
    const res = await fetch(
      `${base}/api/recommend?type=${type}&lat=${coords.lat}&lng=${coords.lng}`,
    );
    const data = await res.json();

    if (!res.ok) {
      errorMessage.value =
        data.error ||
        '식당 추천 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.';
    } else {
      result.value = data;
    }
  } catch {
    errorMessage.value =
      '식당 추천 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.';
  } finally {
    loading.value = false;
  }
}

function reset() {
  result.value = null;
  errorMessage.value = '';
  selectedType.value = '';
  easterEgg.value = null;
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: #fbf6dc;
  min-height: 100vh;
  font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
  color: #1a1a1a;
}

/* 배경 노트 패턴 */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: repeating-linear-gradient(
    transparent,
    transparent 27px,
    rgba(180, 160, 100, 0.15) 27px,
    rgba(180, 160, 100, 0.15) 28px
  );
  pointer-events: none;
  z-index: 0;
}

.page-wrap {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

/* 카드 공통 */
.card {
  background: #ffffff;
  border: 2.5px solid #222222;
  border-radius: 20px;
  padding: 36px 28px;
  width: 100%;
  max-width: 420px;
  /* 손으로 그린 느낌의 그림자 */
  box-shadow: 5px 5px 0px #222222;
  position: relative;
}

/* 메인 카드 */
.doodle-title {
  text-align: center;
  margin-bottom: 8px;
}

.icon-title {
  font-size: 40px;
  display: block;
  margin-bottom: 4px;
}

h1 {
  font-size: 2.2rem;
  font-weight: 900;
  line-height: 1.2;
  text-align: center;
  letter-spacing: -1px;
}

.subtitle {
  text-align: center;
  font-size: 0.95rem;
  color: #555;
  margin: 14px 0 28px;
  line-height: 1.6;
}

/* 2x2 버튼 그리드 */
.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.food-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 12px;
  border: 2.5px solid #222222;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 800;
  font-size: 1rem;
  transition:
    transform 0.1s,
    box-shadow 0.1s;
  box-shadow: 3px 3px 0px #222222;
}

.food-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0px #222222;
}

.food-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0px #222222;
}

.btn-icon {
  font-size: 1.8rem;
}
.btn-label {
  font-size: 1rem;
}

.btn-random { background: #ffe066; }
.btn-soup   { background: #ff9f7a; }
.btn-noodle { background: #a8e6cf; }
.btn-rice   { background: #b5d5ff; }
.btn-snack  { background: #ffd6e7; }
.btn-night  { background: #d4b8ff; }

/* 로딩 카드 */
.loading-card {
  text-align: center;
}

.loading-icon {
  font-size: 3.5rem;
  margin-bottom: 16px;
  display: block;
  animation: wiggle 1s infinite;
}

@keyframes wiggle {
  0%,
  100% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(5deg);
  }
}

.loading-text {
  font-size: 1.3rem;
  font-weight: 800;
  margin-bottom: 6px;
}

.loading-sub {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 20px;
}

.loading-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.loading-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e9b349;
  border: 2px solid #222;
  animation: bounce 0.6s infinite alternate;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
  background: #ff6b6b;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
  background: #6bcb77;
}

@keyframes bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-10px);
  }
}

/* 이스터에그 카드 */
.easter-card {
  text-align: center;
}

.easter-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
  display: block;
  animation: wiggle 1s infinite;
}

.easter-title {
  font-size: 1.2rem;
  font-weight: 900;
  margin-bottom: 10px;
}

.easter-sub {
  font-size: 1.4rem;
  font-weight: 800;
  color: #E9B349;
  margin-bottom: 24px;
  padding: 12px;
  background: #FFF9E8;
  border: 2px solid #222;
  border-radius: 12px;
  box-shadow: 3px 3px 0 #222;
}

/* 에러 카드 */
.error-card {
  text-align: center;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  display: block;
}

.error-text {
  font-size: 1rem;
  color: #444;
  line-height: 1.6;
  margin-bottom: 24px;
}

/* 결과 카드 */
.result-header {
  margin-bottom: 16px;
}

.result-eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  color: #e9b349;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.result-title {
  font-size: 1.5rem;
  font-weight: 900;
}

.result-name-wrap {
  background: #fff9e8;
  border: 2px solid #222;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 3px 3px 0 #222;
}

.result-name {
  font-size: 1.4rem;
  font-weight: 900;
}

.result-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tag {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 4px 12px;
  border: 2px solid #222;
  border-radius: 999px;
  box-shadow: 2px 2px 0 #222;
}

.tag-type {
  background: #ffe066;
}
.tag-keyword {
  background: #a8e6cf;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.92rem;
  line-height: 1.5;
}

.info-icon {
  flex-shrink: 0;
  width: 22px;
}

/* 대표 메뉴 */
.menu-info {
  background: #e8f5e9;
  border: 2px solid #222;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
  box-shadow: 3px 3px 0 #222;
}

.menu-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: #388e3c;
  display: block;
  margin-bottom: 4px;
}

.menu-text {
  font-size: 0.92rem;
  line-height: 1.6;
  color: #1a1a1a;
}

/* AI 말풍선 */
.ai-bubble {
  background: #fdf3d6;
  border: 2px solid #222;
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 20px;
  box-shadow: 3px 3px 0 #222;
  position: relative;
}

.ai-bubble::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 20px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 10px solid #222;
}

.ai-bubble::after {
  content: '';
  position: absolute;
  top: -7px;
  left: 22px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 8px solid #fdf3d6;
}

.ai-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: #e9b349;
  display: block;
  margin-bottom: 6px;
}

.ai-text {
  font-size: 0.92rem;
  line-height: 1.65;
  color: #333;
}

/* 액션 버튼 */
.result-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.map-btn {
  display: block;
  text-align: center;
  text-decoration: none;
  background: #4d96ff;
  color: #fff;
  font-weight: 800;
  font-size: 1rem;
  padding: 14px;
  border: 2.5px solid #222;
  border-radius: 12px;
  box-shadow: 3px 3px 0 #222;
  transition:
    transform 0.1s,
    box-shadow 0.1s;
}

.map-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 #222;
}

.map-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 #222;
}

.reset-btn {
  background: #f5f5f5;
  color: #222;
  font-weight: 800;
  font-size: 1rem;
  padding: 14px;
  border: 2.5px solid #222;
  border-radius: 12px;
  box-shadow: 3px 3px 0 #222;
  cursor: pointer;
  width: 100%;
  transition:
    transform 0.1s,
    box-shadow 0.1s;
}

.reset-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 #222;
}

.reset-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 #222;
}
</style>
