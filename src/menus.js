import Bbs from './pages/Bbs.jsx';
import Todo from './pages/Todo.jsx';
import Calculator from './pages/Calculator.jsx';

// 메뉴를 추가하려면 페이지 컴포넌트를 만들고 이 배열에 항목만 추가하면 됩니다.
// 메인화면 카드와 라우트가 모두 이 배열로 만들어집니다.
export const MENUS = [
  {
    path: '/bbs',
    title: '게시판',
    desc: '글을 작성하고 수정·삭제할 수 있어요.',
    icon: '📋',
    color: 'linear-gradient(135deg, #ff9a56, #ff6a88)',
    Component: Bbs,
  },
  {
    path: '/todo',
    title: 'To do',
    desc: '할 일을 추가하고 완료 여부를 관리해요.',
    icon: '📝',
    color: 'linear-gradient(135deg, #667eea, #764ba2)',
    Component: Todo,
  },
  {
    path: '/calculator',
    title: '계산기',
    desc: '사칙연산을 빠르게 계산해요.',
    icon: '🧮',
    color: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    Component: Calculator,
  },
];
