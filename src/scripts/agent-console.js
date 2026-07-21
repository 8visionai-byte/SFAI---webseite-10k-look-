const consoleRoot = document.querySelector('[data-agent-console]');

if (consoleRoot instanceof HTMLElement) {
  const panel = consoleRoot.querySelector('[data-agent-panel]');
  const fab = document.querySelector('[data-agent-fab]');
  const closeButtons = consoleRoot.querySelectorAll('[data-agent-close]');
  const modeButtons = [...consoleRoot.querySelectorAll('[data-agent-mode]')];
  const chatPanel = consoleRoot.querySelector('[data-agent-chat-panel]');
  const voicePanel = consoleRoot.querySelector('[data-agent-voice-panel]');
  const messageList = consoleRoot.querySelector('[data-agent-messages]');
  const form = consoleRoot.querySelector('[data-agent-form]');
  const input = consoleRoot.querySelector('[data-agent-input]');
  const sendButton = consoleRoot.querySelector('[data-agent-send]');
  const suggestions = consoleRoot.querySelector('[data-agent-suggestions]');
  const connectionStatus = consoleRoot.querySelector('[data-agent-connection-status]');
  const voiceStart = consoleRoot.querySelector('[data-agent-voice-start]');
  const voiceStage = consoleRoot.querySelector('[data-agent-voice-stage]');
  const transcript = consoleRoot.querySelector('[data-agent-transcript]');
  const flowCores = [...document.querySelectorAll('[data-flow-core]')];

  let previousFocus = null;
  let currentMode = 'chat';
  let conversation = [];
  let voicePeer = null;
  let voiceStream = null;
  let voiceAudio = null;
  let voiceChannel = null;
  let voiceMeterContext = null;
  let voiceMeterSource = null;
  let voiceMeterAnalyser = null;
  let voiceMeterData = null;
  let voiceMeterFrame = 0;
  let voiceStateFloor = 0;
  let voiceSessionGeneration = 0;
  let voiceTokenController = null;
  let voiceStartInFlight = false;
  let voiceDisconnectTimer = 0;

  const isVoiceSessionActive = (generation) => (
    generation === voiceSessionGeneration
    && !consoleRoot.hidden
    && currentMode === 'voice'
  );

  const emitVoiceEnergy = (energy = 0, state = '') => {
    const value = Math.min(1, Math.max(0, Number.isFinite(energy) ? energy : 0));
    if (voiceStage instanceof HTMLElement) {
      voiceStage.style.setProperty('--voice-energy', value.toFixed(3));
      if (state) voiceStage.dataset.voiceState = state;
    }
    document.dispatchEvent(new CustomEvent('sfai:voice-energy', { detail: { energy: value, state } }));
  };

  const stopVoiceMeter = () => {
    cancelAnimationFrame(voiceMeterFrame);
    voiceMeterFrame = 0;
    try { voiceMeterSource?.disconnect(); } catch {}
    try { voiceMeterAnalyser?.disconnect(); } catch {}
    const meterContext = voiceMeterContext;
    voiceMeterContext = null;
    voiceMeterSource = null;
    voiceMeterAnalyser = null;
    voiceMeterData = null;
    voiceStateFloor = 0;
    try { meterContext?.close().catch(() => {}); } catch {}
    emitVoiceEnergy(0, 'idle');
  };

  const startVoiceMeter = (stream, generation) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !(stream instanceof MediaStream)) return;
    void (async () => {
      let meterContext = null;
      let meterAnalyser = null;
      let meterSource = null;
      try {
        meterContext = new AudioContextClass();
        if (meterContext.state === 'suspended') await meterContext.resume();
        if (!isVoiceSessionActive(generation) || voiceStream !== stream) return;

        meterAnalyser = meterContext.createAnalyser();
        meterAnalyser.fftSize = 256;
        meterAnalyser.smoothingTimeConstant = .76;
        const meterData = new Uint8Array(meterAnalyser.fftSize);
        meterSource = meterContext.createMediaStreamSource(stream);
        meterSource.connect(meterAnalyser);

        if (!isVoiceSessionActive(generation) || voiceStream !== stream) return;
        voiceMeterContext = meterContext;
        voiceMeterAnalyser = meterAnalyser;
        voiceMeterData = meterData;
        voiceMeterSource = meterSource;

        let smoothEnergy = 0;
        const measure = () => {
          if (!voiceMeterAnalyser || !voiceMeterData || !isVoiceSessionActive(generation)) return;
          try {
            voiceMeterAnalyser.getByteTimeDomainData(voiceMeterData);
            let sum = 0;
            for (const sample of voiceMeterData) {
              const normalized = (sample - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / voiceMeterData.length);
            const target = Math.min(1, Math.max(voiceStateFloor, rms * 5.2));
            const blend = target > smoothEnergy ? .38 : .1;
            smoothEnergy += (target - smoothEnergy) * blend;
            emitVoiceEnergy(smoothEnergy);
            voiceMeterFrame = requestAnimationFrame(measure);
          } catch {
            stopVoiceMeter();
          }
        };
        measure();
        meterContext = null;
        meterAnalyser = null;
        meterSource = null;
      } catch {
        // Metering is enhancement-only. WebRTC must continue without it.
      } finally {
        try { meterSource?.disconnect(); } catch {}
        try { meterAnalyser?.disconnect(); } catch {}
        try { meterContext?.close().catch(() => {}); } catch {}
      }
    })();
  };

  const setConnectionStatus = (label, state = '') => {
    if (!(connectionStatus instanceof HTMLElement)) return;
    connectionStatus.classList.toggle('is-working', state === 'working');
    connectionStatus.classList.toggle('is-local', state === 'local');
    const text = connectionStatus.querySelector('span');
    if (text) text.textContent = label;
  };

  const switchMode = (mode) => {
    const nextMode = mode === 'voice' ? 'voice' : 'chat';
    if (nextMode !== 'voice') stopVoice();
    currentMode = nextMode;
    flowCores.forEach((core) => core.classList.toggle('is-voice-open', currentMode === 'voice' && !consoleRoot.hidden));
    modeButtons.forEach((button) => {
      const active = button.getAttribute('data-agent-mode') === currentMode;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    if (chatPanel instanceof HTMLElement) chatPanel.hidden = currentMode !== 'chat';
    if (voicePanel instanceof HTMLElement) voicePanel.hidden = currentMode !== 'voice';
  };

  const openConsole = (mode = 'chat') => {
    previousFocus = document.activeElement;
    consoleRoot.hidden = false;
    document.body.classList.add('agent-console-open');
    if (fab instanceof HTMLElement) {
      fab.setAttribute('aria-hidden', 'true');
      fab.setAttribute('tabindex', '-1');
    }
    switchMode(mode);
    window.setTimeout(() => {
      const target = currentMode === 'voice' ? voiceStart : input;
      if (target instanceof HTMLElement) target.focus();
    }, 70);
  };

  const stopVoice = () => {
    voiceSessionGeneration += 1;
    voiceStartInFlight = false;
    window.clearTimeout(voiceDisconnectTimer);
    voiceDisconnectTimer = 0;
    voiceTokenController?.abort();
    voiceTokenController = null;
    stopVoiceMeter();
    voiceChannel?.close();
    voicePeer?.close();
    voiceStream?.getTracks().forEach((track) => track.stop());
    if (voiceAudio) {
      voiceAudio.pause();
      voiceAudio.srcObject = null;
      voiceAudio.remove();
    }
    voiceChannel = null;
    voicePeer = null;
    voiceStream = null;
    voiceAudio = null;
    if (voiceStart instanceof HTMLButtonElement) {
      voiceStart.disabled = false;
      voiceStart.setAttribute('aria-pressed', 'false');
      const label = voiceStart.querySelector('span');
      if (label) label.textContent = 'Rozpocznij rozmowę';
    }
    voiceStage?.classList.remove('is-live');
  };

  const closeConsole = () => {
    stopVoice();
    consoleRoot.hidden = true;
    flowCores.forEach((core) => core.classList.remove('is-voice-open'));
    document.body.classList.remove('agent-console-open');
    if (fab instanceof HTMLElement) {
      fab.removeAttribute('aria-hidden');
      fab.removeAttribute('tabindex');
    }
    setConnectionStatus('gotowy');
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  };

  fab?.addEventListener('click', () => openConsole('chat'));
  document.querySelectorAll('[data-agent-open]').forEach((button) => {
    button.addEventListener('click', () => openConsole(button.getAttribute('data-agent-open') || 'chat'));
  });
  closeButtons.forEach((button) => button.addEventListener('click', closeConsole));
  modeButtons.forEach((button) => button.addEventListener('click', () => switchMode(button.getAttribute('data-agent-mode'))));

  consoleRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeConsole();
      return;
    }
    if (event.key !== 'Tab' || !(panel instanceof HTMLElement)) return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href]')]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const resizeInput = () => {
    if (!(input instanceof HTMLTextAreaElement)) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(130, input.scrollHeight)}px`;
    input.style.overflowY = input.scrollHeight > 130 ? 'auto' : 'hidden';
  };
  input?.addEventListener('input', resizeInput);
  input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    form?.requestSubmit();
  });

  const appendMessage = (role, content = '', streaming = false) => {
    if (!(messageList instanceof HTMLElement)) return null;
    const article = document.createElement('article');
    article.className = `agent-message agent-message--${role}`;
    if (streaming) article.classList.add('is-streaming');
    const meta = document.createElement('span');
    meta.className = 'agent-message__meta';
    meta.textContent = role === 'user' ? 'Ty' : 'S/F · AI';
    const paragraph = document.createElement('p');
    paragraph.textContent = content;
    article.append(meta, paragraph);
    messageList.append(article);
    messageList.scrollTop = messageList.scrollHeight;
    return { article, paragraph };
  };

  const fallbackAnswer = (question) => {
    const normalized = question.toLocaleLowerCase('pl-PL');
    if (/cen|koszt|budżet|wycen/.test(normalized)) {
      return 'Cena zależy przede wszystkim od procesu, liczby integracji, ryzyka i zakresu późniejszej opieki. Najpierw warto zrobić krótką diagnozę — po niej można uczciwie określić zakres i budżet: /kontakt/';
    }
    if (/voice|telefon|połącze|rozmow/.test(normalized)) {
      return 'Voicebot AI może odbierać połączenia po polsku, umawiać lub zmieniać terminy, potwierdzać wizyty i przekazywać człowiekowi tylko sprawy wymagające decyzji. Projekt zaczyna się od konkretnego call flow i wyjątków.';
    }
    if (/chatbot|czat|baza wiedzy/.test(normalized)) {
      return 'Chatbot SimpleFast.ai odpowiada na podstawie zatwierdzonej wiedzy firmy, może kwalifikować leady i przekazywać trudne sprawy człowiekowi. Agent AI idzie krok dalej: wykonuje działania w innych systemach, zamiast kończyć na odpowiedzi.';
    }
    if (/seo|geo|stron|google|chatgpt|perplexity|widocz/.test(normalized)) {
      return 'Strona pod SEO i AI łączy mocny design z architekturą treści, SEO technicznym, danymi strukturalnymi i GEO. Celem jest widoczność zarówno w wyszukiwarce, jak i w odpowiedziach systemów AI. Więcej: /uslugi/strony-www-seo-ai/';
    }
    if (/opie|monitor|utrzym|rozw/.test(normalized)) {
      return 'Opieka AI to stały monitoring jakości agentów i automatyzacji, aktualizowanie wiedzy, poprawa wyjątków oraz rozwój integracji. Dzięki temu system po wdrożeniu nie zostaje bez właściciela.';
    }
    if (/agent|automatyz|proces|od czego|zaczą/.test(normalized)) {
      return 'Najlepszy start to nie wybór narzędzia, tylko jednego powtarzalnego procesu. SimpleFast.ai najpierw liczy koszt obecnej pracy i ryzyko, potem buduje najmniejszy działający system, testuje go na żywo i dopiero wtedy skaluje.';
    }
    return 'Mogę pomóc dobrać usługę, wyjaśnić sposób wdrożenia albo uporządkować pierwszy proces do automatyzacji. Napisz proszę: jaka to branża i która powtarzalna czynność zabiera najwięcej czasu?';
  };

  const parseEventBlock = (block) => {
    const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
    if (!data || data === '[DONE]') return null;
    try { return JSON.parse(data); } catch { return null; }
  };

  const streamResponse = async (response, paragraph) => {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseEventBlock(block);
        if (event?.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          answer += event.delta;
          paragraph.textContent = answer;
          if (messageList instanceof HTMLElement) messageList.scrollTop = messageList.scrollHeight;
        }
        boundary = buffer.indexOf('\n\n');
      }
      if (done) break;
    }
    return answer.trim();
  };

  const askAgent = async (question) => {
    appendMessage('user', question);
    conversation.push({ role: 'user', content: question });
    suggestions?.setAttribute('hidden', '');
    const pending = appendMessage('assistant', '', true);
    if (!pending) return;
    setConnectionStatus('myśli', 'working');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation.slice(-14) }),
      });
      if (!response.ok) throw new Error('Agent API unavailable');
      const answer = await streamResponse(response, pending.paragraph);
      if (!answer) throw new Error('Empty response');
      conversation.push({ role: 'assistant', content: answer });
      setConnectionStatus('online');
    } catch {
      const answer = fallbackAnswer(question);
      pending.paragraph.textContent = answer;
      conversation.push({ role: 'assistant', content: answer });
      setConnectionStatus('wiedza lokalna', 'local');
    } finally {
      pending.article.classList.remove('is-streaming');
      if (sendButton instanceof HTMLButtonElement) sendButton.disabled = false;
      if (input instanceof HTMLTextAreaElement) {
        input.disabled = false;
        input.focus();
      }
    }
  };

  suggestions?.querySelectorAll('[data-agent-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      const prompt = button.getAttribute('data-agent-prompt');
      if (prompt) askAgent(prompt);
    });
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!(input instanceof HTMLTextAreaElement)) return;
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    resizeInput();
    input.disabled = true;
    if (sendButton instanceof HTMLButtonElement) sendButton.disabled = true;
    askAgent(question);
  });

  const startVoice = async () => {
    if (!(voiceStart instanceof HTMLButtonElement) || !(transcript instanceof HTMLElement)) return;
    if (consoleRoot.hidden || currentMode !== 'voice') return;
    if (voicePeer) {
      stopVoice();
      transcript.textContent = 'Rozmowa zakończona. Możesz uruchomić ją ponownie.';
      setConnectionStatus('gotowy');
      return;
    }
    if (voiceStartInFlight) return;

    voiceStart.disabled = true;
    voiceStartInFlight = true;
    transcript.textContent = 'Przygotowuję bezpieczne połączenie…';
    setConnectionStatus('łączy', 'working');

    const generation = ++voiceSessionGeneration;
    const controller = new AbortController();
    voiceTokenController?.abort();
    voiceTokenController = controller;

    try {
      const tokenResponse = await fetch('/api/realtime-session', { method: 'POST', signal: controller.signal });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || !token?.value) {
        const sessionError = new Error(token?.error || 'Brak tokenu sesji.');
        sessionError.code = token?.code || 'voice_session_error';
        throw sessionError;
      }
      if (!isVoiceSessionActive(generation)) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isVoiceSessionActive(generation)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      voiceStream = stream;
      startVoiceMeter(stream, generation);
      const peer = new RTCPeerConnection();
      voicePeer = peer;
      voiceAudio = document.createElement('audio');
      voiceAudio.autoplay = true;
      voiceAudio.hidden = true;
      consoleRoot.append(voiceAudio);
      peer.ontrack = (event) => {
        if (isVoiceSessionActive(generation) && voiceAudio) voiceAudio.srcObject = event.streams[0];
      };
      peer.addEventListener('connectionstatechange', () => {
        if (!isVoiceSessionActive(generation) || voicePeer !== peer) return;
        window.clearTimeout(voiceDisconnectTimer);
        voiceDisconnectTimer = 0;

        if (peer.connectionState === 'connected') {
          setConnectionStatus('słucha', 'working');
          return;
        }

        if (peer.connectionState === 'disconnected') {
          transcript.textContent = 'Przywracam połączenie…';
          setConnectionStatus('ponawia', 'working');
          voiceDisconnectTimer = window.setTimeout(() => {
            if (!isVoiceSessionActive(generation) || peer.connectionState !== 'disconnected') return;
            stopVoice();
            transcript.textContent = 'Połączenie zostało przerwane. Uruchom rozmowę ponownie.';
            setConnectionStatus('rozłączony', 'local');
          }, 4_000);
          return;
        }

        if (peer.connectionState === 'failed') {
          stopVoice();
          transcript.textContent = 'Nie udało się utrzymać połączenia. Uruchom rozmowę ponownie.';
          setConnectionStatus('błąd połączenia', 'local');
        }
      });
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      voiceChannel = peer.createDataChannel('oai-events');
      voiceChannel.addEventListener('open', () => {
        if (!isVoiceSessionActive(generation)) return;
        voiceStateFloor = .14;
        emitVoiceEnergy(.14, 'listening');
        transcript.textContent = 'Słucham. Zacznij mówić.';
        setConnectionStatus('słucha', 'working');
        voiceStart.disabled = false;
        voiceStart.setAttribute('aria-pressed', 'true');
        const label = voiceStart.querySelector('span');
        if (label) label.textContent = 'Zakończ rozmowę';
        voiceStage?.classList.add('is-live');
        voiceChannel?.send(JSON.stringify({
          type: 'response.create',
          response: {
            output_modalities: ['audio'],
            instructions: 'Przywitaj użytkownika naturalną, rodzimą polszczyzną z neutralnym, ogólnopolskim akcentem, jednym krótkim i w pełni dokończonym zdaniem, a potem zapytaj, w czym możesz pomóc jego firmie.',
          },
        }));
      });
      voiceChannel.addEventListener('message', (event) => {
        if (!isVoiceSessionActive(generation)) return;
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'input_audio_buffer.speech_started') {
          voiceStateFloor = .28;
          emitVoiceEnergy(.42, 'listening');
          transcript.textContent = 'Słucham…';
          setConnectionStatus('słucha', 'working');
        } else if (data.type === 'input_audio_buffer.speech_stopped') {
          voiceStateFloor = .12;
          emitVoiceEnergy(.18, 'thinking');
        } else if (data.type === 'response.created') {
          voiceStateFloor = .76;
          emitVoiceEnergy(.9, 'speaking');
          setConnectionStatus('mówi', 'working');
        } else if (data.type === 'response.done') {
          voiceStateFloor = .14;
          emitVoiceEnergy(.2, 'listening');
          setConnectionStatus('słucha', 'working');
        } else if (data.type === 'error') {
          voiceStateFloor = 0;
          emitVoiceEnergy(0, 'error');
          transcript.textContent = 'Połączenie zostało przerwane. Spróbuj ponownie.';
          setConnectionStatus('błąd', 'local');
        }
      });

      const offer = await peer.createOffer();
      if (!isVoiceSessionActive(generation)) return;
      await peer.setLocalDescription(offer);
      if (!isVoiceSessionActive(generation)) return;
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token.value}`,
          'Content-Type': 'application/sdp',
        },
      });
      if (!sdpResponse.ok) throw new Error('Nie udało się zestawić połączenia.');
      const answerSdp = await sdpResponse.text();
      if (!isVoiceSessionActive(generation)) return;
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (error) {
      if (!isVoiceSessionActive(generation)) return;
      stopVoice();
      if (error?.name === 'NotAllowedError') {
        transcript.textContent = 'Dostęp do mikrofonu nie został udzielony.';
        setConnectionStatus('brak mikrofonu', 'local');
      } else if (error?.code === 'voice_rate_limited') {
        transcript.textContent = error.message;
        setConnectionStatus('limit rozmów', 'local');
      } else if (error?.code === 'agent_not_configured') {
        transcript.textContent = 'Interfejs jest gotowy. Do rozmowy potrzebny jest bezpieczny klucz API ustawiony na hostingu.';
        setConnectionStatus('oczekuje na klucz', 'local');
      } else {
        transcript.textContent = 'Nie udało się uruchomić rozmowy. Spróbuj ponownie lub użyj czatu tekstowego.';
        setConnectionStatus('głos nieaktywny', 'local');
      }
    } finally {
      if (voiceTokenController === controller) voiceTokenController = null;
      if (generation === voiceSessionGeneration) voiceStartInFlight = false;
    }
  };

  voiceStart?.addEventListener('click', startVoice);
  window.addEventListener('pagehide', stopVoice);
}
