import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  LocalDataProvider,
  type JsonValue,
  type LobbySettings,
} from "@ofcpoker/data-provider";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "../src/App";
import type { ClientDataProvider, ProviderFactory } from "../src/providers";

const providers: LocalDataProvider<JsonValue, JsonValue, JsonValue>[] = [];

afterEach(async () => {
  for (const provider of providers.splice(0)) await provider.dispose();
});

function localProvider(): LocalDataProvider<JsonValue, JsonValue, JsonValue> {
  const provider = new LocalDataProvider<JsonValue, JsonValue, JsonValue>();
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
    await screen.findByRole("heading", { name: "Your game is ready." }),
  ).toHaveFocus();
  expect(factory.create).toHaveBeenCalledWith("local-ai");
  expect(screen.queryByText("You and 3 AI opponents.")).not.toBeInTheDocument();
  expect(screen.getAllByRole("definition")).toHaveLength(5);
  expect(
    screen.getByText("Settings cannot be changed after creation."),
  ).toBeVisible();
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
      await screen.findByRole("heading", { name: "Waiting for players." }),
    ).toBeVisible();
    expect(factory.create).toHaveBeenCalledWith("multiplayer");
    expect(screen.getByText("2 of 3 players seated.")).toBeVisible();
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
});
