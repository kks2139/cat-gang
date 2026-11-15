// 내 위치 핀에 새겨진 발바닥 무늬(주머니 + 발가락 3개)를 공통화한 아이콘.
// 산책 거리 캡슐 등 어디서든 재사용할 수 있고, 도형 원본(pawShapeMarkup)은
// 24x24 viewBox 기준으로 내보내 위치 핀처럼 다른 SVG 안에 중첩(nested svg)으로도 쓸 수 있다.
export const pawShapeMarkup = `<ellipse cx="12" cy="14" rx="5.8" ry="4.7"/><circle cx="6.2" cy="7.6" r="2.7"/><circle cx="12" cy="5.8" r="2.7"/><circle cx="17.8" cy="7.6" r="2.7"/>`;

interface PawIconProps {
  size?: number;
  color?: string;
  className?: string;
}

const PawIcon = ({
  size = 24,
  color = "currentColor",
  className,
}: PawIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color}
    className={className}
    aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: pawShapeMarkup }}
  />
);

export default PawIcon;
