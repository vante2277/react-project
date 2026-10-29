import Bbs from './pages/Bbs.jsx';
import Todo from './pages/Todo.jsx';
// import Calculator from './pages/Calculator.jsx';
import Stocks from './pages/Stocks.jsx';
import Weather from './pages/Weather.jsx';
import Quotes from './pages/Quotes.jsx';
import Pisik from './pages/Pisik.jsx';

// 메뉴를 추가하려면 페이지 컴포넌트를 만들고 이 배열에 항목만 추가하면 됩니다.
// 메인화면 카드와 라우트가 모두 이 배열로 만들어집니다.
// path 대신 href 를 쓰면 외부 사이트로 연결되는 메뉴가 됩니다. (새 탭으로 열림)
export const MENUS = [
  {
    path: '/bbs',
    title: '게시판',
    desc: '글을 작성하고 수정·삭제할 수 있어요.',
    icon: '📋',
    Component: Bbs,
  },
  {
    path: '/todo',
    title: 'To do',
    desc: '할 일을 추가하고 완료 여부를 관리해요.',
    icon: '📝',
    Component: Todo,
  },
  // {
  //   path: '/calculator',
  //   title: '계산기',
  //   desc: '사칙연산을 빠르게 계산해요.',
  //   icon: '🧮',
  //   Component: Calculator,
  // },
  {
    href: 'https://stock.naver.com/',
    title: '네이버증권',
    desc: '네이버증권에서 시세와 뉴스를 확인해요.',
    icon: '💹',
  },
  {
    path: '/stocks',
    title: '주식지수',
    desc: '한국·미국·중국·대만·일본 지수를 한눈에 봐요.',
    icon: '📈',
    Component: Stocks,
  },
  {
    path: '/weather',
    title: '전국날씨',
    desc: '전국 지도에서 오늘과 일주일 날씨를 확인해요.',
    icon: '🌤️',
    Component: Weather,
  },
  {
    path: '/quotes',
    title: '투자명언',
    desc: '세계 투자 대가들의 명언을 모아 봐요.',
    icon: '💬',
    Component: Quotes,
  },
  {
    path: '/pisik',
    title: '피식',
    desc: '매일 아침 배치가 모아 오는 짧고 웃긴 만화 한 편.',
    icon: '😏',
    Component: Pisik,
  },
];
