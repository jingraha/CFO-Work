"use client";

import { MAX_REVIEW_MESSAGES, type ReviewMeetingView, type SystemConnection } from "@cfo/domain";
import { Button, cn } from "@cfo/ui";
import { Camera, CameraOff, ChevronLeft, ChevronRight, MessageSquare, Play, Send, Square, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { askReviewQuestionAction, updateReviewMeetingAction } from "@/app/app/automation-actions";
import { ErrorNotice, fieldClass, mutedClass, readableTime, SourceRevisionNotice, type ActionBase, type ExecuteAction } from "./environment-ui";

const suggestions = ["What needs attention?", "Which sources support this?", "What should I do next?"];

export function LocalReviewRoom({ meeting, systems, base, editable, busy, execute }: {
  meeting: ReviewMeetingView; systems: SystemConnection[]; base: ActionBase; editable: boolean; busy: boolean; execute: ExecuteAction;
}) {
  const [question, setQuestion] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraPending, setCameraPending] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [viewSlideIndex, setViewSlideIndex] = useState(meeting.slideIndex);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const slides = meeting.artifact.slides;
  const readOnlySlides = !editable || meeting.status === "ended";
  const slideIndex = Math.min(readOnlySlides ? viewSlideIndex : meeting.slideIndex, Math.max(slides.length - 1, 0));
  const slide = slides[slideIndex];
  const active = meeting.status === "active";
  const cameraOn = active && cameraStream !== null;
  const messageLimit = meeting.messages.length + 2 > MAX_REVIEW_MESSAGES;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video && active) video.srcObject = cameraStream;
    return () => {
      requestRef.current += 1;
      cameraStream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [cameraStream, active]);

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [meeting.messages.length]);

  function stopCamera() {
    requestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    setCameraPending(false);
  }

  async function startCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable. Use localhost or HTTPS in a supported browser. You can still review slides without a camera.");
      return;
    }
    const request = ++requestRef.current;
    setCameraPending(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // Permission can resolve after the room has closed or the user cancels.
      if (!mountedRef.current || request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraStream(stream);
    } catch (cause) {
      if (mountedRef.current && request === requestRef.current) {
        setCameraError(`Camera could not start: ${cause instanceof Error ? cause.message : "permission was denied or no camera was found"}. Slides and questions still work.`);
      }
    } finally {
      if (mountedRef.current && request === requestRef.current) setCameraPending(false);
    }
  }

  async function setMeeting(status: ReviewMeetingView["status"], index = slideIndex) {
    if (status === "ended") { stopCamera(); setViewSlideIndex(index); }
    await execute(`meeting-${meeting.id}`, () => updateReviewMeetingAction({ ...base, meetingId: meeting.id, status, slideIndex: index }), false);
  }

  function navigateSlide(index: number) {
    if (readOnlySlides) setViewSlideIndex(index);
    else void setMeeting(meeting.status, index);
  }

  async function ask(text: string) {
    if (!text.trim() || !active || !editable) return;
    if (await execute(`question-${meeting.id}`, () => askReviewQuestionAction({ ...base, meetingId: meeting.id, question: text.trim() }), false)) setQuestion("");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-purple-950"><Video className="size-4 shrink-0" />Local rehearsal — no remote participants, no recording</p>
        <p className="mt-2 text-sm leading-6 text-purple-900">Your optional camera stays in this browser. No microphone, upload, remote call, or recording. The facilitator uses deterministic answers grounded in this saved artifact, not a live LLM.</p>
      </div>
      <SourceRevisionNotice sources={meeting.artifact.sources} systems={systems} savedReview />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500"><span className="font-semibold capitalize text-slate-800">{meeting.status}</span> · Saved {readableTime(meeting.createdAt)}</p>
        {editable && <div className="flex flex-wrap gap-2">
          {meeting.status === "scheduled" && <Button disabled={busy} onClick={() => setMeeting("active")}><Play className="size-4" />Start local rehearsal</Button>}
          {active && <Button variant="secondary" disabled={busy} onClick={() => setMeeting("ended")}><Square className="size-3.5" />End review</Button>}
        </div>}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
        <div className="space-y-4">
          <div className="relative flex min-h-80 flex-col overflow-hidden rounded-2xl bg-slate-950 p-7 text-white sm:p-9">
            <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-purple-500/15" />
            <p className="relative text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300">Finance review / synthetic company</p>
            {slide ? <><h3 className="relative mt-6 text-2xl font-semibold leading-tight">{slide.title}</h3><ul className="relative mt-6 space-y-4 text-sm leading-7 text-slate-200">{slide.bullets.map((bullet, i) => <li key={i} className="flex gap-3"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-violet-400" />{bullet}</li>)}</ul></> : <p className="mt-8 text-sm text-slate-300">No slides were generated for this artifact.</p>}
            <div className="relative mt-auto flex justify-between gap-3 pt-8 text-[10px] text-slate-400"><span>DETERMINISTIC DEMO</span><span>{slides.length ? `${slideIndex + 1} / ${slides.length}` : "0 slides"}</span></div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button size="sm" variant="secondary" aria-label="Previous slide" disabled={busy || slideIndex <= 0} onClick={() => navigateSlide(slideIndex - 1)}><ChevronLeft className="size-4" />Previous</Button>
            <p aria-live="polite" className="text-xs text-slate-500">Slide {slides.length ? slideIndex + 1 : 0} of {slides.length}</p>
            <Button size="sm" variant="secondary" aria-label="Next slide" disabled={busy || slideIndex >= slides.length - 1} onClick={() => navigateSlide(slideIndex + 1)}>Next<ChevronRight className="size-4" /></Button>
          </div>
          {slide && <details className="rounded-xl border border-[var(--border)] p-4" open><summary className="cursor-pointer text-sm font-semibold">Speaker notes</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{slide.speakerNotes}</p></details>}
          {editable && active && (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-sm font-semibold">Your local camera</h4><Button variant="secondary" size="sm" onClick={cameraOn || cameraPending ? stopCamera : startCamera}>
                {cameraOn || cameraPending ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
                {cameraPending ? "Cancel camera request" : cameraOn ? "Turn camera off" : "Enable local camera"}
              </Button></div>
              <video ref={videoRef} autoPlay muted playsInline aria-label="Your local camera preview" className={cn("max-h-52 w-full rounded-lg bg-slate-950 object-contain", !cameraOn && "hidden")} />
              {cameraOn && <p className="text-xs text-emerald-800">Camera on · local preview only · microphone off</p>}
              {!cameraOn && <p className="text-xs leading-5 text-slate-500">{cameraPending ? "Waiting for browser camera permission. You can cancel this request." : "Camera is off. Permission is requested only when you click Enable local camera."}</p>}
              <ErrorNotice>{cameraError}</ErrorNotice>
            </section>
          )}
          {meeting.status === "ended" && <p className={mutedClass}>This saved review has ended. The camera is off. Start a new review from the output to rehearse again.</p>}
        </div>
        <section className="flex min-w-0 flex-col rounded-2xl border border-[var(--border)]">
          <div className="border-b border-[var(--border)] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4 text-purple-600" />Artifact-grounded facilitator</h3><p className="mt-1 text-xs text-slate-500">Deterministic responses · conversation saved locally on the server</p></div>
          <div ref={historyRef} role="log" aria-label="Review conversation" aria-live="polite" className="max-h-[440px] min-h-64 space-y-3 overflow-y-auto p-4">
            {meeting.messages.map((message, i) => <div key={`${message.at}-${i}`} className={cn("rounded-xl p-3", message.role === "user" ? "ml-5 bg-purple-50" : "mr-5 bg-slate-50")}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{message.role === "user" ? "You / reviewer" : "Demo facilitator"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p><time className="mt-2 block text-[10px] text-slate-400">{readableTime(message.at)}</time></div>)}
            {!meeting.messages.length && <p className={mutedClass}>Ask about the output, its sources, or the next action.</p>}
          </div>
          {editable && active && (
            <div className="space-y-3 border-t border-[var(--border)] p-4">
              <div className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} disabled={busy || messageLimit} className="rounded-full border border-purple-200 px-2.5 py-1.5 text-left text-xs text-purple-800 hover:bg-purple-50 disabled:opacity-50" onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>
              <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
                <label htmlFor="review-question" className="sr-only">Ask about this artifact</label>
                <textarea id="review-question" className={fieldClass} rows={3} minLength={2} maxLength={2000} required value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this artifact…" disabled={messageLimit} />
                <Button type="submit" size="sm" disabled={busy || question.trim().length < 2 || messageLimit}><Send className="size-3.5" />Ask facilitator</Button>
              </form>
              {messageLimit && <p className="text-xs text-amber-800">This review has reached its message limit. End it and create another review to continue.</p>}
            </div>
          )}
          {!active && <p className="border-t border-[var(--border)] p-4 text-sm text-slate-500">{meeting.status === "scheduled" ? "Start the local rehearsal to ask questions or use your camera." : "Saved conversation. This review is read-only."}</p>}
          {!editable && active && <p className="border-t border-[var(--border)] p-4 text-sm text-slate-500">Read-only access. An administrator or finance editor can run this review.</p>}
        </section>
      </div>
    </div>
  );
}
