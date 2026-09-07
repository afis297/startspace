function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

/**
 * Returns user-facing feedback for every entry point that invokes auto-layout.
 * Keeping the copy here prevents the command palette, settings and widget packs
 * from reporting conflicting outcomes for the same layout plan.
 */
export function getMasonryFeedback(plan, { addedCount = null } = {}) {
  const unplacedCount = nonNegativeInteger(plan?.unplacedCount);
  const count = nonNegativeInteger(plan?.count);
  const hasAddedCount = addedCount !== null && addedCount !== undefined && Number.isFinite(Number(addedCount));
  const added = hasAddedCount ? nonNegativeInteger(addedCount) : null;

  if (unplacedCount) {
    const prefix = added === null ? "" : `Добавлено: ${added}. `;
    return {
      title: added === null ? "Не все виджеты размещены" : "Набор добавлен не полностью",
      message: `${prefix}Не удалось разместить: ${unplacedCount}. Освободите место, уменьшите или открепите карточки и повторите авторасстановку.`,
      type: "warning",
    };
  }

  if (added !== null) {
    return {
      title: "Набор добавлен",
      message: `Добавлено виджетов: ${added}. Раскладка: ${Math.max(1, nonNegativeInteger(plan?.columns))} кол.`,
      type: "success",
    };
  }

  if (plan?.unchanged || !plan?.placements?.length) {
    const pinnedCount = nonNegativeInteger(plan?.pinnedCount);
    if (pinnedCount > 0) {
      return {
        title: "Двигать нечего",
        message: `Подвижных виджетов нет: закреплено ${pinnedCount}. Открепите карточки и повторите авторасстановку.`,
        type: "info",
      };
    }
    return {
      title: "Раскладка уже готова",
      message: "Виджеты уже стоят по мозаике — двигать нечего.",
      type: "info",
    };
  }

  return {
    title: "Раскладка обновлена",
    message: `Размещено виджетов: ${count}.`,
    type: "success",
  };
}
