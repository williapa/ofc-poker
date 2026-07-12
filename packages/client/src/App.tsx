import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DataProviderError,
  type JsonValue,
  type LobbyConnection,
  type LobbyMetadata,
} from "@ofcpoker/data-provider";
import {
  createHomeUrl,
  createJoinUrl,
  createLobbySettings,
  DEFAULT_LOBBY_FORM,
  DISPLAY_NAME_MAX_LENGTH,
  parseAppRoute,
  validateDisplayName,
  validateSeatCount,
  type AppRoute,
  type LobbyFormValues,
  type SeatCount,
} from "./lobby";
import {
  createBrowserProviderFactory,
  type ClientDataProvider,
  type ProviderFactory,
} from "./providers";

type ClientConnection = LobbyConnection<JsonValue, JsonValue, JsonValue>;

export interface AppProps {
  readonly providerFactory?: ProviderFactory;
  readonly initialUrl?: string;
}

function currentUrl(initialUrl?: string): URL {
  return new URL(initialUrl ?? window.location.href, "https://local.invalid/");
}

function readableError(error: unknown): string {
  if (error instanceof DataProviderError) {
    switch (error.code) {
      case "lobby-missing":
        return "That lobby could not be found. Check the link and try again.";
      case "lobby-full":
        return "That lobby is already full.";
      case "lobby-active":
        return "That game has already started.";
      case "lobby-closed":
        return "That lobby is closed. Ask the host for a new link.";
      default:
        return error.message;
    }
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function Brand() {
  return (
    <div className="brand" aria-label="Open Face Club">
      <span className="brand-mark" aria-hidden="true">
        ♢
      </span>
      <span>Open Face Club</span>
    </div>
  );
}

function FixedRules() {
  return (
    <fieldset className="fixed-rules" aria-describedby="fixed-rules-note">
      <legend>Table rules</legend>
      <div className="rule-row">
        <span>Game</span>
        <strong>Standard OFC</strong>
      </div>
      <div className="rule-row">
        <span>Fantasyland</span>
        <strong>On</strong>
      </div>
      <div className="rule-row">
        <span>Tied rows</span>
        <strong>0 points</strong>
      </div>
      <p id="fixed-rules-note" className="field-note">
        Rules and player count are locked after the lobby is created.
      </p>
    </fieldset>
  );
}

interface HomeScreenProps {
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly onCreate: (values: LobbyFormValues) => void;
}

function HomeScreen({ busy, error, onCreate }: HomeScreenProps) {
  const [values, setValues] = useState(DEFAULT_LOBBY_FORM);
  const [nameError, setNameError] = useState<string>();
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextNameError = validateDisplayName(values.displayName);
    const seatError = validateSeatCount(values.seatCount);
    setNameError(nextNameError ?? seatError);
    if (!nextNameError && !seatError) onCreate(values);
  }

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="app-title">
        <Brand />
        <div className="hero-copy">
          <p className="eyebrow">A game of patience and nerve</p>
          <h1 id="app-title">Build it in the open.</h1>
          <p className="lede">
            Thirteen cards. Three hands. Every decision on the table.
          </p>
        </div>
        <div className="board-motif" aria-hidden="true">
          <span>3</span>
          <span>5</span>
          <span>5</span>
        </div>
      </section>

      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="panel-heading">
          <p className="step">New table</p>
          <h2 id="setup-title">Take a seat</h2>
          <p>Set up the table once. The cards take it from there.</p>
        </div>

        {error ? (
          <div
            className="error-banner"
            role="alert"
            tabIndex={-1}
            ref={errorRef}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} noValidate>
          <div className="field-group">
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              name="displayName"
              autoComplete="nickname"
              maxLength={DISPLAY_NAME_MAX_LENGTH + 1}
              value={values.displayName}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "display-name-error" : undefined}
              onChange={(event) => {
                setValues({ ...values, displayName: event.target.value });
                if (nameError) setNameError(undefined);
              }}
              placeholder="What should we call you?"
            />
            {nameError ? (
              <p id="display-name-error" className="field-error">
                {nameError}
              </p>
            ) : null}
          </div>

          <fieldset className="mode-fieldset">
            <legend>How do you want to play?</legend>
            <div className="mode-options">
              <label className={values.mode === "local-ai" ? "selected" : ""}>
                <input
                  type="radio"
                  name="mode"
                  value="local-ai"
                  checked={values.mode === "local-ai"}
                  onChange={() => setValues({ ...values, mode: "local-ai" })}
                />
                <span>
                  <strong>Local AI</strong>
                  <small>Play instantly on this device</small>
                </span>
              </label>
              <label
                className={values.mode === "multiplayer" ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="mode"
                  value="multiplayer"
                  checked={values.mode === "multiplayer"}
                  onChange={() => setValues({ ...values, mode: "multiplayer" })}
                />
                <span>
                  <strong>Multiplayer</strong>
                  <small>Invite friends with a link</small>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="field-group player-count">
            <label htmlFor="player-count">Players</label>
            <select
              id="player-count"
              value={values.seatCount}
              onChange={(event) =>
                setValues({
                  ...values,
                  seatCount: Number(event.target.value) as SeatCount,
                })
              }
            >
              <option value={2}>2 players</option>
              <option value={3}>3 players</option>
              <option value={4}>4 players</option>
            </select>
            <p className="field-note">
              {values.mode === "local-ai"
                ? `You and ${values.seatCount - 1} AI opponent${values.seatCount === 2 ? "" : "s"}.`
                : "The host counts as one player."}
            </p>
          </div>

          <FixedRules />

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Creating table…" : "Create table"}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  );
}

interface JoinScreenProps {
  readonly lobbyId: string;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly homeUrl: string;
  readonly onJoin: (displayName: string) => void;
  readonly onHome: () => void;
}

function JoinScreen({
  lobbyId,
  busy,
  error,
  homeUrl,
  onJoin,
  onHome,
}: JoinScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <main className="centered-shell">
      <section className="join-card" aria-labelledby="join-title">
        <Brand />
        <p className="eyebrow">Invitation received</p>
        <h1 id="join-title">Join the table</h1>
        <p className="lobby-code">
          Lobby <strong>{lobbyId}</strong>
        </p>
        {error ? (
          <div
            className="error-banner"
            role="alert"
            tabIndex={-1}
            ref={errorRef}
          >
            {error}
          </div>
        ) : null}
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const nextError = validateDisplayName(displayName);
            setNameError(nextError);
            if (!nextError) onJoin(displayName);
          }}
        >
          <div className="field-group">
            <label htmlFor="join-display-name">Display name</label>
            <input
              id="join-display-name"
              autoComplete="nickname"
              maxLength={DISPLAY_NAME_MAX_LENGTH + 1}
              value={displayName}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "join-name-error" : undefined}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (nameError) setNameError(undefined);
              }}
              autoFocus
            />
            {nameError ? (
              <p id="join-name-error" className="field-error">
                {nameError}
              </p>
            ) : null}
          </div>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Joining…" : "Join lobby"}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <a
          className="text-link"
          href={homeUrl}
          onClick={(event) => {
            event.preventDefault();
            onHome();
          }}
        >
          Create a different table
        </a>
      </section>
    </main>
  );
}

function LobbySettingsView({ lobby }: { readonly lobby: LobbyMetadata }) {
  return (
    <section
      className="immutable-settings"
      aria-labelledby="lobby-settings-title"
    >
      <div>
        <p className="step">Table settings</p>
        <h2 id="lobby-settings-title">Locked for this lobby</h2>
      </div>
      <dl>
        <div>
          <dt>Mode</dt>
          <dd>
            {lobby.settings.mode === "local-ai" ? "Local AI" : "Multiplayer"}
          </dd>
        </div>
        <div>
          <dt>Players</dt>
          <dd>{lobby.settings.seatCount}</dd>
        </div>
        <div>
          <dt>Game</dt>
          <dd>Standard OFC</dd>
        </div>
        <div>
          <dt>Fantasyland</dt>
          <dd>On</dd>
        </div>
        <div>
          <dt>Tied rows</dt>
          <dd>0 points</dd>
        </div>
      </dl>
      <p className="lock-note">
        <span aria-hidden="true">◆</span> Settings cannot be changed after
        creation.
      </p>
    </section>
  );
}

interface LobbyScreenProps {
  readonly lobby: LobbyMetadata;
  readonly joinUrl: string;
  readonly onHome: () => void;
}

function LobbyScreen({ lobby, joinUrl, onHome }: LobbyScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <main className="centered-shell lobby-shell">
      <section className="lobby-card" aria-labelledby="lobby-title">
        <Brand />
        <p className="eyebrow">Table ready</p>
        <h1 id="lobby-title" ref={headingRef} tabIndex={-1}>
          {lobby.settings.mode === "local-ai"
            ? "Your game is ready."
            : "Waiting for players."}
        </h1>
        <p className="lede">
          {lobby.settings.mode === "local-ai"
            ? "Your opponents are seated. Gameplay arrives in the next milestone."
            : `${lobby.participants.length} of ${lobby.settings.seatCount} players seated.`}
        </p>
        {lobby.settings.mode === "multiplayer" ? (
          <div className="share-link">
            <label htmlFor="join-link">Invite link</label>
            <input
              id="join-link"
              readOnly
              value={joinUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        ) : null}
        <LobbySettingsView lobby={lobby} />
        <button className="secondary-button" type="button" onClick={onHome}>
          Leave table
        </button>
      </section>
    </main>
  );
}

function InvalidJoinScreen({
  message,
  homeUrl,
  onHome,
}: {
  readonly message: string;
  readonly homeUrl: string;
  readonly onHome: () => void;
}) {
  return (
    <main className="centered-shell">
      <section className="join-card" aria-labelledby="invalid-title">
        <Brand />
        <p className="eyebrow">Link problem</p>
        <h1 id="invalid-title">We can’t find that table.</h1>
        <div className="error-banner" role="alert">
          {message}
        </div>
        <a
          className="primary-button anchor-button"
          href={homeUrl}
          onClick={(event) => {
            event.preventDefault();
            onHome();
          }}
        >
          Create a new table <span aria-hidden="true">→</span>
        </a>
      </section>
    </main>
  );
}

export function App({ providerFactory, initialUrl }: AppProps) {
  const baseUrl = useMemo(() => currentUrl(initialUrl), [initialUrl]);
  const factory = useMemo(
    () =>
      providerFactory ??
      createBrowserProviderFactory({
        ...(import.meta.env.VITE_PLAYROOM_GAME_ID
          ? { playroomGameId: import.meta.env.VITE_PLAYROOM_GAME_ID }
          : {}),
      }),
    [providerFactory],
  );
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(baseUrl));
  const [connection, setConnection] = useState<ClientConnection>();
  const [provider, setProvider] = useState<ClientDataProvider>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(
    () => () => {
      void connection?.dispose();
      void provider?.dispose();
    },
    [connection, provider],
  );

  function navigateHome() {
    void connection?.dispose();
    void provider?.dispose();
    setConnection(undefined);
    setProvider(undefined);
    setError(undefined);
    setRoute({ page: "home" });
    if (!initialUrl) window.history.pushState({}, "", createHomeUrl(baseUrl));
  }

  async function createLobby(values: LobbyFormValues) {
    setBusy(true);
    setError(undefined);
    let nextProvider: ClientDataProvider | undefined;
    try {
      nextProvider = await factory.create(values.mode);
      const nextConnection = await nextProvider.createLobby(
        createLobbySettings(values),
        { displayName: values.displayName.trim() },
      );
      setProvider(nextProvider);
      setConnection(nextConnection);
      if (values.mode === "multiplayer" && !initialUrl) {
        window.history.pushState(
          {},
          "",
          createJoinUrl(baseUrl, nextConnection.lobby.id),
        );
      }
    } catch (cause) {
      await nextProvider?.dispose();
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function joinLobby(displayName: string) {
    if (route.page !== "join") return;
    setBusy(true);
    setError(undefined);
    let nextProvider: ClientDataProvider | undefined;
    try {
      nextProvider = await factory.create("multiplayer");
      const nextConnection = await nextProvider.joinLobby(route.lobbyId, {
        displayName: displayName.trim(),
      });
      setProvider(nextProvider);
      setConnection(nextConnection);
    } catch (cause) {
      await nextProvider?.dispose();
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (connection) {
    return (
      <LobbyScreen
        lobby={connection.lobby}
        joinUrl={createJoinUrl(baseUrl, connection.lobby.id)}
        onHome={navigateHome}
      />
    );
  }
  if (route.page === "invalid-join") {
    return (
      <InvalidJoinScreen
        message={route.message}
        homeUrl={createHomeUrl(baseUrl)}
        onHome={navigateHome}
      />
    );
  }
  if (route.page === "join") {
    return (
      <JoinScreen
        lobbyId={route.lobbyId}
        busy={busy}
        error={error}
        homeUrl={createHomeUrl(baseUrl)}
        onJoin={(name) => void joinLobby(name)}
        onHome={navigateHome}
      />
    );
  }
  return (
    <HomeScreen
      busy={busy}
      error={error}
      onCreate={(values) => void createLobby(values)}
    />
  );
}
