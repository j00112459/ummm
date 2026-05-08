require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const keywordMap = {
  random: [
    '한식',
    '분식',
    '식당',
    '밥집',
    '음식점',
    '정식',
    '도시락',
    '치킨',
    '피자',
    '버거',
    '족발',
    '보쌈',
    '떡볶이',
  ],
  soup: [
    '국밥',
    '찌개',
    '해장국',
    '순대국',
    '마라탕',
    '설렁탕',
    '곰탕',
    '부대찌개',
    '된장찌개',
    '김치찌개',
    '샤브샤브',
    '전골',
    '탕',
  ],
  noodle: [
    '라멘',
    '칼국수',
    '냉면',
    '우동',
    '짜장면',
    '소국수',
    '막국수',
    '쌀국수',
    '파스타',
    '스파게티',
    '짬뽕',
    '볶음면',
    '국수',
  ],
  rice: [
    '백반',
    '덮밥',
    '비빔밥',
    '김치볶음밥',
    '한식',
    '솥밥',
    '오므라이스',
    '볶음밥',
    '카레',
    '돈부리',
    '초밥',
    '김밥',
    '포케',
  ],
  snack: [
    '떡볶이',
    '순대',
    '튀김',
    '붕어빵',
    '분식',
    '핫도그',
    '타코야키',
    '오뎅',
  ],
  night: ['치킨', '피자', '족발', '보쌈', '라면', '곱창', '막창', '삼겹살'],
};

const typeLabelMap = {
  random: '랜덤',
  soup: '국물',
  noodle: '면',
  rice: '밥',
  snack: '간식',
  night: '야식',
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 네이버 블로그 검색으로 리뷰 요약 조회
async function fetchNaverBlogReviews(placeName) {
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET)
    return null;

  try {
    const res = await axios.get(
      'https://openapi.naver.com/v1/search/blog.json',
      {
        headers: {
          'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
        },
        params: { query: `${placeName} 후기`, display: 3, sort: 'sim' },
      },
    );

    const items = res.data.items;
    if (!items || items.length === 0) return null;

    const strip = (s) =>
      s
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, '');
    return items
      .map((item) => `- ${strip(item.title)}: ${strip(item.description)}`)
      .join('\n');
  } catch {
    return null;
  }
}

// 공공데이터 TourAPI에서 메뉴 정보 조회
async function fetchMenuFromTourAPI(placeName, lat, lng) {
  if (!process.env.PUBLIC_DATA_API_KEY) return null;

  try {
    // 위치 기반으로 근처 음식점 검색
    const searchRes = await axios.get(
      'https://apis.data.go.kr/B551011/KorService1/locationBasedList1',
      {
        params: {
          serviceKey: process.env.PUBLIC_DATA_API_KEY,
          mapX: lng,
          mapY: lat,
          radius: 500,
          contentTypeId: 39, // 음식점
          MobileOS: 'ETC',
          MobileApp: 'lunch-recommend',
          _type: 'json',
          numOfRows: 20,
        },
      },
    );

    const items = searchRes.data?.response?.body?.items?.item;
    if (!items) return null;

    const list = Array.isArray(items) ? items : [items];

    // 식당 이름으로 매칭 (공백 제거 후 비교)
    const normalize = (s) => s.replace(/\s/g, '').toLowerCase();
    const target = normalize(placeName);
    const matched = list.find((item) => normalize(item.title) === target);
    if (!matched) return null;

    // 상세 메뉴 정보 조회
    const detailRes = await axios.get(
      'https://apis.data.go.kr/B551011/KorService1/detailIntro1',
      {
        params: {
          serviceKey: process.env.PUBLIC_DATA_API_KEY,
          contentId: matched.contentid,
          contentTypeId: 39,
          MobileOS: 'ETC',
          MobileApp: 'lunch-recommend',
          _type: 'json',
        },
      },
    );

    const detail = detailRes.data?.response?.body?.items?.item;
    const detailItem = Array.isArray(detail) ? detail[0] : detail;
    const menu = detailItem?.firstmenu;

    return menu || null;
  } catch {
    return null;
  }
}

app.get('/api/recommend', async (req, res) => {
  const { type, lat, lng } = req.query;

  if (!type || !lat || !lng) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
  }

  if (!keywordMap[type]) {
    return res.status(400).json({ error: '올바르지 않은 type입니다.' });
  }

  const keyword = pickRandom(keywordMap[type]);

  // Kakao Local API 호출
  let restaurants;
  try {
    const kakaoRes = await axios.get(
      'https://dapi.kakao.com/v2/local/search/keyword.json',
      {
        headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
        params: {
          query: keyword,
          x: lng,
          y: lat,
          radius: 1000,
          sort: 'distance',
          size: 15,
          category_group_code: 'FD6',
        },
      },
    );
    restaurants = kakaoRes.data.documents;
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'Kakao API 호출 오류가 발생했습니다.' });
  }

  if (!restaurants || restaurants.length === 0) {
    return res
      .status(404)
      .json({ error: '근처에 조건에 맞는 식당을 찾지 못했어요.' });
  }

  const restaurant = pickRandom(restaurants);
  const distance = parseInt(restaurant.distance) || 0;
  const walkingMinutes = Math.ceil(distance / 70);

  // TourAPI(메뉴) + 네이버 블로그(리뷰) 동시 조회
  const [menuInfo, blogReviews] = await Promise.all([
    fetchMenuFromTourAPI(restaurant.place_name, lat, lng),
    fetchNaverBlogReviews(restaurant.place_name),
  ]);

  // OpenAI 추천 문장 생성
  let aiMessage = `${restaurant.place_name}은 현재 위치에서 도보 약 ${walkingMinutes}분 거리에 있어요. ${typeLabelMap[type]} 메뉴로 좋은 선택입니다.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 점심 식당을 추천해주는 친근한 도우미입니다.
아래 규칙을 반드시 지켜서 3~4문장의 추천 문장을 작성하세요.
- 말투는 친근하고 가볍게, 읽는 사람이 당장 가고 싶게 만드세요
- 블로그 리뷰가 있으면 구체적인 내용을 자연스럽게 한 문장 안에 녹여주세요
- 음식 카테고리의 특징(따뜻함, 든든함, 자극적 등)을 자연스럽게 살려주세요
- 거리와 도보 시간을 긍정적으로 표현하세요.
- "리뷰에 따르면", "블로그에서" 같은 출처 표현 금지 — 자연스럽게 녹여내기
- 과장 금지 (예: "맛집입니다", "강추입니다" 금지)
- 제공된 정보 외 창작 금지`,
        },
        {
          role: 'user',
          content: `선택 유형: ${typeLabelMap[type]}
검색 키워드: ${keyword}
식당명: ${restaurant.place_name}
카테고리: ${restaurant.category_name}
거리: ${distance}m
도보 예상 시간: 약 ${walkingMinutes}분
주소: ${restaurant.road_address_name || restaurant.address_name}${menuInfo ? `\n대표 메뉴: ${menuInfo}` : ''}${blogReviews ? `\n\n블로그 리뷰 참고:\n${blogReviews}` : ''}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.8,
    });
    aiMessage = completion.choices[0].message.content.trim();
  } catch (err) {
    // OpenAI 실패 시 기본 문장 사용
  }

  res.json({
    type,
    typeLabel: typeLabelMap[type],
    keyword,
    restaurant: {
      place_name: restaurant.place_name,
      category_name: restaurant.category_name,
      distance: restaurant.distance,
      address_name: restaurant.address_name,
      road_address_name: restaurant.road_address_name,
      place_url: restaurant.place_url,
    },
    walkingMinutes,
    menuInfo,
    aiMessage,
  });
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
