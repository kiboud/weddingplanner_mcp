import { calendar_v3, google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export type CalendarEventInput = {
  calendarId?: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  transparency?: 'opaque' | 'transparent';
  guestsCanInviteOthers?: boolean;
  guestsCanModify?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
};

export type CalendarEventUpdateInput = Partial<Omit<CalendarEventInput, 'summary'>> & {
  summary?: string;
};

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private defaultCalendarId: string;
  private defaultTimeZone: string;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
    this.defaultCalendarId = process.env.CALENDAR_ID || 'primary';
    this.defaultTimeZone = process.env.CALENDAR_TIME_ZONE || process.env.TZ || 'Asia/Jakarta';
  }

  async listEvents(options: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
  }) {
    const response = await this.calendar.events.list({
      calendarId: this.getCalendarId(options.calendarId),
      timeMin: options.timeMin || new Date().toISOString(),
      timeMax: options.timeMax,
      maxResults: options.maxResults || 20,
      q: options.query,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (response.data.items || []).map(event => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.map(attendee => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus,
      })) || [],
      htmlLink: event.htmlLink,
      status: event.status,
    }));
  }

  async createEvent(input: CalendarEventInput) {
    const response = await this.calendar.events.insert({
      calendarId: this.getCalendarId(input.calendarId),
      sendUpdates: input.sendUpdates,
      requestBody: this.toEventRequest(input),
    });

    return this.toEventResult(response.data);
  }

  async getEvent(calendarId: string | undefined, eventId: string) {
    const response = await this.calendar.events.get({
      calendarId: this.getCalendarId(calendarId),
      eventId,
    });

    return this.toEventResult(response.data);
  }

  async updateEvent(eventId: string, input: CalendarEventUpdateInput) {
    const response = await this.calendar.events.patch({
      calendarId: this.getCalendarId(input.calendarId),
      eventId,
      sendUpdates: input.sendUpdates,
      requestBody: this.toEventRequest(input),
    });

    return this.toEventResult(response.data);
  }

  async addAttendees(calendarId: string | undefined, eventId: string, attendees: string[], sendUpdates?: 'all' | 'externalOnly' | 'none') {
    const current = await this.calendar.events.get({
      calendarId: this.getCalendarId(calendarId),
      eventId,
    });

    const existingAttendees = current.data.attendees || [];
    const existingEmails = new Set(existingAttendees.map(attendee => attendee.email?.toLowerCase()).filter(Boolean));
    const newAttendees = attendees
      .filter(email => email && email.trim() !== '')
      .map(email => email.trim())
      .filter(email => !existingEmails.has(email.toLowerCase()))
      .map(email => ({ email }));

    const response = await this.calendar.events.patch({
      calendarId: this.getCalendarId(calendarId),
      eventId,
      sendUpdates,
      requestBody: {
        attendees: [...existingAttendees, ...newAttendees],
      },
    });

    return this.toEventResult(response.data);
  }

  async removeAttendees(calendarId: string | undefined, eventId: string, attendees: string[], sendUpdates?: 'all' | 'externalOnly' | 'none') {
    const current = await this.calendar.events.get({
      calendarId: this.getCalendarId(calendarId),
      eventId,
    });

    const emailsToRemove = new Set(
      attendees
        .filter(email => email && email.trim() !== '')
        .map(email => email.trim().toLowerCase())
    );
    const remainingAttendees = (current.data.attendees || [])
      .filter(attendee => !attendee.email || !emailsToRemove.has(attendee.email.toLowerCase()));

    const response = await this.calendar.events.patch({
      calendarId: this.getCalendarId(calendarId),
      eventId,
      sendUpdates,
      requestBody: {
        attendees: remainingAttendees,
      },
    });

    return this.toEventResult(response.data);
  }

  async deleteEvent(calendarId: string | undefined, eventId: string) {
    await this.calendar.events.delete({
      calendarId: this.getCalendarId(calendarId),
      eventId,
    });

    return { success: true, eventId };
  }

  private getCalendarId(calendarId?: string) {
    return calendarId || this.defaultCalendarId;
  }

  private toEventRequest(input: CalendarEventUpdateInput): calendar_v3.Schema$Event {
    const event: calendar_v3.Schema$Event = {};

    if (input.summary !== undefined) event.summary = input.summary;
    if (input.description !== undefined) event.description = input.description;
    if (input.location !== undefined) event.location = input.location;
    if (input.start !== undefined) event.start = this.toEventDateTime(input.start, input.timeZone);
    if (input.end !== undefined) event.end = this.toEventDateTime(input.end, input.timeZone);
    if (input.recurrence !== undefined) event.recurrence = input.recurrence;
    if (input.reminders !== undefined) event.reminders = input.reminders;
    if (input.colorId !== undefined) event.colorId = input.colorId;
    if (input.visibility !== undefined) event.visibility = input.visibility;
    if (input.transparency !== undefined) event.transparency = input.transparency;
    if (input.guestsCanInviteOthers !== undefined) event.guestsCanInviteOthers = input.guestsCanInviteOthers;
    if (input.guestsCanModify !== undefined) event.guestsCanModify = input.guestsCanModify;
    if (input.guestsCanSeeOtherGuests !== undefined) event.guestsCanSeeOtherGuests = input.guestsCanSeeOtherGuests;
    if (input.attendees !== undefined) {
      event.attendees = input.attendees
        .filter(email => email && email.trim() !== '')
        .map(email => ({ email: email.trim() }));
    }

    return event;
  }

  private toEventDateTime(value: string, timeZone?: string): calendar_v3.Schema$EventDateTime {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { date: value };
    }

    return {
      dateTime: value,
      timeZone: timeZone || this.defaultTimeZone,
    };
  }

  private toEventResult(event: calendar_v3.Schema$Event) {
    return {
      id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.map(attendee => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus,
      })) || [],
      htmlLink: event.htmlLink,
      status: event.status,
      creator: event.creator,
      organizer: event.organizer,
      created: event.created,
      updated: event.updated,
      recurringEventId: event.recurringEventId,
      recurrence: event.recurrence,
      reminders: event.reminders,
      colorId: event.colorId,
      visibility: event.visibility,
      transparency: event.transparency,
      guestsCanInviteOthers: event.guestsCanInviteOthers,
      guestsCanModify: event.guestsCanModify,
      guestsCanSeeOtherGuests: event.guestsCanSeeOtherGuests,
    };
  }
}
