// 현재 열려있는 다이얼로그들의 dismiss 콜백 스택 —
// 뒤로가기에는 최상단(마지막에 열린) 다이얼로그만 닫힌다
const dismissStack: Array<() => void> = [];

export const pushDialogDismiss = (dismiss: () => void) => {
  dismissStack.push(dismiss);
};

export const removeDialogDismiss = (dismiss: () => void) => {
  const index = dismissStack.lastIndexOf(dismiss);
  if (index !== -1) {
    dismissStack.splice(index, 1);
  }
};

export const getTopDialogDismiss = () => dismissStack[dismissStack.length - 1];
