import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function fetchGoogleCalendars(accessToken: string) {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    return data.items || []; 
  } catch (e) {
    console.error("Fetch Calendars Error:", e);
    return [];
  }
}

export async function fetchCalendarEvents(accessToken: string, calendarId: string) {
  try {
    const now = new Date().toISOString();
    // Fetch from now until 14 days out for the demo
    const future = new Date();
    future.setDate(future.getDate() + 14);
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${now}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    return data.items || [];
  } catch (e) {
    console.error("Fetch Events Error:", e);
    return [];
  }
}