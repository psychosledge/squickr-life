# ADR-027: FCM Push Notifications Use Data-Only Messages

**Date**: 2026-04-04
**Status**: Accepted

## Context

The habit reminder Cloud Function sent FCM messages with a `notification` field. On Android/Chrome PWA, when FCM receives a message with a `notification` field while the app is backgrounded, two things happen independently:

1. FCM's platform layer auto-displays a system tray notification using the app's default icon (a grey letter fallback).
2. The service worker's `onBackgroundMessage` handler fires and shows a second notification with the branded Squickr icon.

Users received two identical notifications per habit reminder with different icons (UAT-confirmed bug).

## Decision

All FCM messages sent from Cloud Functions must use **data-only format**: no `notification` field. Title, body, and any deep-link data go in the `data` map as strings. The `firebase-messaging-sw.js` service worker is the single point of notification display, reading from `payload.data`.

## Consequences

**Positive:**
- Single notification per event on Android/Chrome, always with the branded icon.
- Service worker has full control over presentation (icon, vibration patterns, action buttons, and is prepared for deep-link routing when client routing supports it).
- Future notification types (sync conflicts, etc.) follow the same pattern without re-litigating this decision.

**Negative:**
- **iOS limitation**: Data-only FCM messages are silently dropped by Apple Push Notification Service when the PWA is backgrounded or terminated. iOS requires a `notification` field or an `apns.payload.aps` body to display a banner. Habit reminders are therefore not delivered to iOS users. If iOS push support is added in future, the Cloud Function must branch on platform (using `apns` overrides) or send separate APNs messages. Tracked as a known limitation.
- All `data` values must be strings; complex payloads (e.g. a JSON array of habit IDs) must be JSON-serialised in the Cloud Function and parsed in the service worker.
- Data-only messages bypass FCM's built-in notification-open analytics. App-side analytics must be implemented manually via `notificationclick` if needed.

## SOLID Principles

- **Single Responsibility**: The service worker is the sole owner of notification display; the Cloud Function is responsible only for delivery. Previously the `notification` field gave FCM platform layer an implicit second display responsibility.
- **Open/Closed**: The service worker handler can be extended (action buttons, deep links, badge updates) without modifying the Cloud Function payload contract, as long as `data` map keys are additive.
