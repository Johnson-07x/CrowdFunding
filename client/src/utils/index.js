export const daysLeft = (deadline) => {
  // deadline is a Unix timestamp in seconds from the contract
  // Convert to milliseconds by multiplying by 1000
  const deadlineMs =
    typeof deadline === "number"
      ? deadline * 1000
      : new Date(deadline).getTime();
  const difference = deadlineMs - Date.now();
  const remainingDays = difference / (1000 * 3600 * 24);

  return remainingDays.toFixed(0);
};

export const calculateBarPercentage = (goal, raisedAmount) => {
  const percentage = Math.round((raisedAmount * 100) / goal);

  return percentage;
};

export const checkIfImage = (url, callback) => {
  const img = new Image();
  img.src = url;

  if (img.complete) callback(true);

  img.onload = () => callback(true);
  img.onerror = () => callback(false);
};
