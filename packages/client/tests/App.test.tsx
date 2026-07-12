import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  DataProviderError,
  LocalDataProvider,
  type LobbySettings,
} from "@ofcpoker/data-provider";
import type { OfcHandAction, OfcHandEvent } from "@ofcpoker/game-engine";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "../src/App";
import type { ClientDataProvider, ProviderFactory } from "../src/providers";
import type { OfcRunnerSnapshot } from "../src/contracts/game-runner";
import { createMemoryLobbySessionStore } from "../src/reconnect";
import { expectNoCriticalAccessibilityViolations } from "./setup";

type TestProvider = LocalDataProvider<
  OfcHandAction,
  OfcRunnerSnapshot,
  OfcHandEvent
>;

const providers: TestProvider[] = [];

afterEach(async () => {
  for (const provider of providers.splice(0)) await provider.dispose();
});

function localProvider(): TestProvider {
  const provider = new LocalDataProvider<
    OfcHandAction,
    OfcRunnerSnapshot,
    OfcHandEvent
  >();
  providers.push(provider);
  return provider;
}

function factoryFor(provider: ClientDataProvider) {
  return {
    create: vi.fn(async () => provider),
  } satisfies ProviderFactory;
}

test("renders accessible typed defaults without initializing a provider", () => {
  const factory = factoryFor(localProvider());
  render(
    <App
      providerFactory={factory}
      initialUrl="https://example.test/ofcpoker/"
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Build it in the open." }),
  ).toBeVisible();
  expect(screen.getByRole("radio", { name: /Local AI/ })).toBeChecked();
  expect(screen.getByRole("combobox", { name: "Players" })).toHaveValue("2");
  expect(
    screen.getByText(
      "Rules and player count are locked after the lobby is created.",
    ),
  ).toBeVisible();
  expect(factory.create).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("radio", { name: /Local AI/ }));
  expect(factory.create).not.toHaveBeenCalled();
});

test("has no critical accessibility violations on the home screen", async () => {
  const { container } = render(
    <App
      providerFactory={factoryFor(localProvider())}
      initialUrl="https://example.test/ofcpoker/"
    />,
  );

  await expectNoCriticalAccessibilityViolations(container);
});

test("validates the display name inline and moves focus to provider errors", async () => {
  const factory: ProviderFactory = {
    create: vi.fn(async () => {
      throw new Error("Service unavailable");
    }),
  };
  render(
    <App
      providerFactory={factory}
      initialUrl="https://example.test/ofcpoker/"
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /Create table/ }));
  expect(screen.getByText("Enter a display name.")).toBeVisible();
  expect(factory.create).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Ada" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Create table/ }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Service unavailable");
  expect(alert).toHaveFocus();
});

test("creates a local AI lobby through explicit provider wiring", async () => {
  const provider = localProvider();
  const factory = factoryFor(provider);
  render(
    <App
      providerFactory={factory}
      initialUrl="https://example.test/ofcpoker/"
    />,
  );

  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: " Ada " },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Players" }), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Create table/ }));

  expect(
    await screen.findByRole("heading", { name: "Open Face Chinese Poker" }),
  ).toBeVisible();
  expect(factory.create).toHaveBeenCalledWith("local-ai");
  expect(screen.queryByText("You and 3 AI opponents.")).not.toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "Scores" })).toBeVisible();
  expect(screen.getByText("Mina · AI")).toBeVisible();
  expect(screen.getByText("Theo · AI")).toBeVisible();
  expect(screen.getByText("Iris · AI")).toBeVisible();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

test("creates a repository-base-safe multiplayer invite link", async () => {
  const provider = localProvider();
  const factory = factoryFor(provider);
  render(
    <App
      providerFactory={factory}
      initialUrl="https://example.test/ofcpoker/index.html"
    />,
  );

  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Host" },
  });
  fireEvent.click(screen.getByRole("radio", { name: /Multiplayer/ }));
  fireEvent.click(screen.getByRole("button", { name: /Create table/ }));

  const invite = await screen.findByLabelText("Invite link");
  expect(invite).toHaveValue(
    "https://example.test/ofcpoker/index.html?lobby=lobby-1",
  );
  expect(factory.create).toHaveBeenCalledWith("multiplayer");
});

test("shows the room code and copies the multiplayer invite", async () => {
  const provider = localProvider();
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(
    <App
      providerFactory={factoryFor(provider)}
      initialUrl="https://example.test/ofcpoker/"
    />,
  );

  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Host" },
  });
  fireEvent.click(screen.getByRole("radio", { name: /Multiplayer/ }));
  fireEvent.click(screen.getByRole("button", { name: /Create table/ }));

  expect(await screen.findByText("Room code")).toHaveTextContent("lobby-1");
  fireEvent.click(screen.getByRole("button", { name: "Copy invite" }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      "https://example.test/ofcpoker/?lobby=lobby-1",
    ),
  );
  expect(screen.getByText("Invite link copied.")).toBeVisible();
});

describe("join flow", () => {
  const settings: LobbySettings = {
    schemaVersion: 1,
    seatCount: 3,
    mode: "multiplayer",
    rules: { variant: "standard-ofc", fantasyland: true, tiedRowPoints: 0 },
  };

  test("joins from a query link and shows settings as immutable data", async () => {
    const provider = localProvider();
    const host = await provider.createLobby(settings, { displayName: "Host" });
    const factory = factoryFor(provider);
    render(
      <App
        providerFactory={factory}
        initialUrl={`https://example.test/ofcpoker/?lobby=${host.lobby.id}`}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Join the table" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join lobby" }));

    expect(
      await screen.findByRole("heading", { name: "Waiting for players" }),
    ).toBeVisible();
    expect(factory.create).toHaveBeenCalledWith("multiplayer");
    expect(screen.getByText(/2 of 3 players\s+seated\./)).toBeVisible();
    expect(
      screen.getByText("Settings cannot be changed after creation."),
    ).toBeVisible();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("rejects malformed join links before creating a provider", () => {
    const factory = factoryFor(localProvider());
    render(
      <App
        providerFactory={factory}
        initialUrl="https://example.test/ofcpoker/?lobby=%20bad%20id"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "We can’t find that table." }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "valid lobby identifier",
    );
    expect(factory.create).not.toHaveBeenCalled();
  });

  test("shows a helpful error for a well-formed missing lobby", async () => {
    const factory = factoryFor(localProvider());
    render(
      <App
        providerFactory={factory}
        initialUrl="https://example.test/ofcpoker/?lobby=missing"
      />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join lobby" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("could not be found"),
    );
  });

  test("shows a full-lobby recovery path", async () => {
    const provider = localProvider();
    const host = await provider.createLobby(
      { ...settings, seatCount: 2 },
      { displayName: "Host" },
    );
    await provider.joinLobby(host.lobby.id, { displayName: "First guest" });
    render(
      <App
        providerFactory={factoryFor(provider)}
        initialUrl={`https://example.test/ofcpoker/?lobby=${host.lobby.id}`}
      />,
    );

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Extra guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join lobby" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already full");
    expect(
      screen.getByRole("link", { name: "Create a different table" }),
    ).toBeVisible();
  });

  test.each([
    ["initialization-failed" as const, "Multiplayer could not initialize"],
    ["incompatible-version" as const, "incompatible game version"],
  ])("shows recovery copy for %s", async (code, message) => {
    const factory: ProviderFactory = {
      create: vi.fn(async () => {
        throw new DataProviderError(code, "provider detail");
      }),
    };
    render(
      <App
        providerFactory={factory}
        initialUrl="https://example.test/ofcpoker/?lobby=ROOM-FAIL"
      />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join lobby" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      screen.getByRole("link", { name: "Create a different table" }),
    ).toBeVisible();
  });

  test("automatically restores a saved peer seat and current lobby state", async () => {
    const provider = localProvider();
    const host = await provider.createLobby(settings, { displayName: "Host" });
    const peer = await provider.joinLobby(host.lobby.id, {
      displayName: "Guest",
    });
    const participantId = peer.participant.id;
    const store = createMemoryLobbySessionStore();
    store.save({
      schemaVersion: 1,
      lobbyId: host.lobby.id,
      reconnectToken: peer.reconnectToken,
      role: "peer",
    });
    await peer.disconnect();
    const factory = factoryFor(provider);

    render(
      <App
        providerFactory={factory}
        lobbySessionStore={store}
        initialUrl={`https://example.test/ofcpoker/?lobby=${host.lobby.id}`}
      />,
    );

    expect(await screen.findByText("Guest (you)")).toBeVisible();
    expect(factory.create).toHaveBeenCalledWith("multiplayer");
    expect(store.load(host.lobby.id)?.reconnectToken).toBe(peer.reconnectToken);
    expect(
      screen.getByRole("complementary", { name: "Scores" }),
    ).toHaveTextContent("Guest (you)");
    expect(participantId).toBeTruthy();
  });

  test("explains the no-host-reconnect policy and offers a new table", async () => {
    const store = createMemoryLobbySessionStore();
    store.save({
      schemaVersion: 1,
      lobbyId: "ROOM-HOST",
      reconnectToken: "host-token",
      role: "host",
    });
    const factory = factoryFor(localProvider());
    render(
      <App
        providerFactory={factory}
        lobbySessionStore={store}
        initialUrl="https://example.test/ofcpoker/?lobby=ROOM-HOST"
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "host session cannot be restored",
    );
    expect(
      screen.getByRole("link", { name: "Create a different table" }),
    ).toBeVisible();
    expect(factory.create).not.toHaveBeenCalled();
    expect(store.load("ROOM-HOST")).toBeUndefined();
  });
});
