import "server-only";

import { APP_NAME, appUrl, supportEmail } from "@/lib/env";
import { sendPlatformEmail } from "@/lib/email";
import { formatPrice, GRACE_DAYS, PLAN, RETENTION_DAYS } from "@/lib/plans";
import { REFERRAL_REWARD_TEXT } from "@/lib/referrals";

/** Platform billing mail. Always from our domain; never subject to studio suppressions. */

const sig = `${APP_NAME}\n${supportEmail()}`;
const billingUrl = () => `${appUrl()}/studio/billing`;
const price = () => `${formatPrice(PLAN.monthlyCents)} a month`;

export function sendTrialEndingEmail(to: string, studioName: string, daysLeft: number) {
  const url = billingUrl();
  return sendPlatformEmail({
    to,
    kind: "trial_ending",
    subject: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left on your ${APP_NAME} trial`,
    text: `Your free trial for ${studioName} ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.\n\nTo keep everything running, start your subscription: ${price()}, everything included, unlimited team members, cancel any time.\n\n${url}\n\nIf you do nothing, the studio becomes read-only when the trial ends. Client galleries and your website stay live for ${GRACE_DAYS} more days.\n\n${sig}`,
    cta: { label: "Start your subscription", url },
  });
}

export function sendTrialEndedEmail(to: string, studioName: string) {
  const url = billingUrl();
  return sendPlatformEmail({
    to,
    kind: "trial_ended",
    subject: `Your ${APP_NAME} trial for ${studioName} has ended`,
    text: `The free trial for ${studioName} has ended and the studio is now read-only. Client galleries and your website stay live for ${GRACE_DAYS} days.\n\nSubscribe to pick up where you left off: ${price()}, everything included.\n\n${url}\n\n${sig}`,
    cta: { label: "Subscribe", url },
  });
}

export function sendPaymentFailedEmail(to: string, studioName: string) {
  const url = billingUrl();
  return sendPlatformEmail({
    to,
    kind: "payment_failed",
    subject: `Payment failed for ${studioName}`,
    text: `We could not charge the card on file for ${studioName}. Stripe will retry over the next few days. To avoid interruption, update the card in billing:\n${url}\n\n${sig}`,
    cta: { label: "Update payment method", url },
  });
}

export function sendSubscriptionCancelledEmail(to: string, studioName: string, endsOn: string | null) {
  const url = billingUrl();
  return sendPlatformEmail({
    to,
    kind: "subscription_cancelled",
    subject: `Your ${APP_NAME} subscription for ${studioName} is cancelled`,
    text: `Your subscription for ${studioName} is cancelled${endsOn ? ` and ends on ${endsOn}` : ""}. After that the studio becomes read-only, galleries and your website stay live for ${GRACE_DAYS} days, and your data is kept for ${RETENTION_DAYS} days in case you come back.\n\nChanged your mind? You can resume any time:\n${url}\n\n${sig}`,
    cta: { label: "Manage billing", url },
  });
}

export function sendPurgeWarningEmail(to: string, studioName: string, daysLeft: number) {
  const url = billingUrl();
  return sendPlatformEmail({
    to,
    kind: "purge_warning",
    subject: `${studioName}: data is deleted in ${daysLeft} days`,
    text: `The data for ${studioName} (clients, galleries, photos, documents) is deleted in ${daysLeft} days because the subscription ended. Export everything from Settings → Data, or subscribe to keep it.\n\n${url}\n\n${sig}`,
    cta: { label: "Keep my studio", url },
  });
}

export function sendReferralFriendJoinedEmail(to: string, referrerStudio: string, friendStudio: string) {
  return sendPlatformEmail({
    to,
    kind: "referral_signed_up",
    subject: `${friendStudio} joined ${APP_NAME} with your link`,
    text: `Good news for ${referrerStudio}: ${friendStudio} signed up using your referral link. When their first payment goes through, you both get ${REFERRAL_REWARD_TEXT}.\n\n${sig}`,
  });
}

export function sendReferralRewardEmail(to: string, studioName: string, applied: boolean) {
  const url = `${appUrl()}/studio/referrals`;
  return sendPlatformEmail({
    to,
    kind: "referral_rewarded",
    subject: applied ? `Your ${REFERRAL_REWARD_TEXT} is on` : `Your referral reward is queued`,
    text: applied
      ? `A referral for ${studioName} paid off: ${REFERRAL_REWARD_TEXT} is now applied to your subscription. Thank you for spreading the word.\n\n${url}\n\n${sig}`
      : `A referral for ${studioName} paid off. Your ${REFERRAL_REWARD_TEXT} is queued and applies as soon as your current discount ends (or when you subscribe).\n\n${url}\n\n${sig}`,
    cta: { label: "See your referrals", url },
  });
}
