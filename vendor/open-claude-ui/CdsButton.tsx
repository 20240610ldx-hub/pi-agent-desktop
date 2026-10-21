/**
 * Claude Design System (CDS) - Button System
 *
 * 逆向溯源：依据 REA v6.5.0 对 Claude Desktop 生产环境 (shared-frame-BfjMqbuN.js / c6a992d55-sXiDGMFQ.css)
 * AST 逆向提取的完整按钮阶梯与物理阻尼规范。
 *
 * PIL-0116 / C02：尺寸、内边距、圆角、间距与状态颜色全部由 app/native-theme.css 的
 * “C02 按钮尺寸与交互状态”分节里的 --cds-btn-* 令牌提供，本文件只输出语义类名与可访问属性，
 * 不再混用 Tailwind 工具类（此前两处各写一份，Tailwind 的边框会与主题边框叠成双线）。
 * xs 档数值取自 3.1623 原生截图量测（agent-panels-light，原像素 ÷ 1.5），记录见 relay-evidence/PIL-0116。
 */

import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "brand" | "onContent" | "outline";
export type ButtonSize = "xxs" | "xs" | "sm" | "md" | "lg" | "icon";

export interface CdsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
  indicator?: React.ReactNode;
}

export const CdsButton = forwardRef<HTMLButtonElement, CdsButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon,
      iconPosition = "left",
      isLoading = false,
      indicator,
      disabled = false,
      children,
      className = "",
      onClick,
      ...props
    },
    ref
  ) => {
    const isIconOnly = size === "icon" || (!children && !!icon);
    const classes = [
      "cds-button",
      `cds-button--${variant}`,
      `cds-button--${size}`,
      isIconOnly ? "cds-button--icon-only" : "",
      isLoading ? "is-loading" : "",
      className,
    ].filter(Boolean).join(" ");

    return (
      <button
        type="button"
        ref={ref}
        data-cds="Button"
        // 加载中不用 disabled：禁用按钮会丢失键盘焦点，操作结束后焦点无法按宿主恢复。
        disabled={disabled}
        aria-busy={isLoading || undefined}
        aria-disabled={isLoading || undefined}
        className={classes}
        onClick={isLoading ? undefined : onClick}
        {...props}
      >
        {isLoading ? (
          <span aria-hidden="true" className="cds-button__spinner" />
        ) : (
          icon && iconPosition === "left" && <span className="cds-button__icon">{icon}</span>
        )}

        {children && <span className="cds-button__label">{children}</span>}

        {!isLoading && icon && iconPosition === "right" && !isIconOnly && (
          <span className="cds-button__icon">{icon}</span>
        )}

        {indicator && (
          <span data-cds-part="indicator" className="cds-button__indicator">
            {indicator}
          </span>
        )}
      </button>
    );
  }
);

CdsButton.displayName = "CdsButton";
