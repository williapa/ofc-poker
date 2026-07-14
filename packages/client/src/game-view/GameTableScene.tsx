import { useEffect, useMemo } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import {
  parseCard,
  type CardCode,
  type OfcBoard,
  type PlacementRow,
  type PlayerId,
} from "@ofcpoker/game-engine";
import {
  cardFaceLabels,
  GAME_VIEW_TOKENS,
  ROW_DEFINITIONS,
} from "./design-system";
import type { SeatLayout } from "./layout";

export interface SceneSeat {
  readonly id: PlayerId;
  readonly board: OfcBoard;
  readonly layout: SeatLayout;
  readonly faceDown: boolean;
  readonly hiddenCardCount: number;
}

export interface GameTableSceneProps {
  readonly seats: readonly SceneSeat[];
  readonly pendingCards: readonly CardCode[];
  readonly assignments: Readonly<Partial<Record<CardCode, PlacementRow>>>;
  readonly selectedCard: CardCode | undefined;
  readonly validRows: readonly PlacementRow[];
  readonly reducedMotion: boolean;
  readonly onSelectCard: (card: CardCode) => void;
  readonly onSelectRow: (row: PlacementRow) => void;
}

function createFaceTexture(code: CardCode): Texture {
  const card = parseCard(code);
  const [rank, suit] = cardFaceLabels(code);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas 2D is unavailable");
  context.fillStyle = GAME_VIEW_TOKENS.color.card;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle =
    card.suit === "d" || card.suit === "h"
      ? GAME_VIEW_TOKENS.color.redSuit
      : GAME_VIEW_TOKENS.color.ink;
  context.font = `700 ${GAME_VIEW_TOKENS.cardFace.rankFontPx}px ${GAME_VIEW_TOKENS.typography.card}`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(
    rank,
    GAME_VIEW_TOKENS.cardFace.rankX,
    GAME_VIEW_TOKENS.cardFace.rankY,
  );
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${GAME_VIEW_TOKENS.cardFace.suitFontPx}px ${GAME_VIEW_TOKENS.typography.card}`;
  context.fillText(
    suit,
    GAME_VIEW_TOKENS.cardFace.suitX,
    GAME_VIEW_TOKENS.cardFace.suitY,
  );
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function PlayingCard({
  code,
  position,
  selected = false,
  interactive = false,
  reducedMotion,
  faceUp = true,
  onClick,
}: {
  readonly code: CardCode;
  readonly position: readonly [number, number, number];
  readonly selected?: boolean;
  readonly interactive?: boolean;
  readonly reducedMotion: boolean;
  readonly faceUp?: boolean;
  readonly onClick?: () => void;
}) {
  const texture = useMemo(() => createFaceTexture(code), [code]);
  useEffect(() => () => texture.dispose(), [texture]);
  const lift = selected ? GAME_VIEW_TOKENS.motion.selectedLift : 0;
  return (
    <group
      position={[position[0], position[1] + lift, position[2]]}
      name={faceUp ? `card-${code}` : "card-back"}
      userData={{
        selected,
        interactive,
        motionDurationMs: reducedMotion
          ? GAME_VIEW_TOKENS.motion.reducedDurationMs
          : GAME_VIEW_TOKENS.motion.durationMs,
      }}
      {...(interactive && onClick
        ? {
            onClick: (event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation();
              onClick();
            },
          }
        : {})}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry
          args={[
            GAME_VIEW_TOKENS.card.width,
            GAME_VIEW_TOKENS.card.depth,
            GAME_VIEW_TOKENS.card.height,
          ]}
        />
        <meshStandardMaterial
          color={
            faceUp
              ? GAME_VIEW_TOKENS.color.card
              : GAME_VIEW_TOKENS.color.cardBack
          }
        />
      </mesh>
      {faceUp ? (
        <mesh
          position={[0, GAME_VIEW_TOKENS.card.depth / 2 + 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry
            args={[
              GAME_VIEW_TOKENS.card.width * 0.94,
              GAME_VIEW_TOKENS.card.height * 0.94,
            ]}
          />
          <meshBasicMaterial map={texture} />
        </mesh>
      ) : (
        <>
          <mesh
            position={[0, GAME_VIEW_TOKENS.card.depth / 2 + 0.002, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry
              args={[
                GAME_VIEW_TOKENS.card.width * 0.9,
                GAME_VIEW_TOKENS.card.height * 0.9,
              ]}
            />
            <meshBasicMaterial color={GAME_VIEW_TOKENS.color.cardBack} />
          </mesh>
          <mesh
            position={[0, GAME_VIEW_TOKENS.card.depth / 2 + 0.004, 0]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
          >
            <planeGeometry args={[0.24, 0.24]} />
            <meshBasicMaterial color={GAME_VIEW_TOKENS.color.cardBackAccent} />
          </mesh>
        </>
      )}
      {selected ? (
        <mesh position={[0, -0.005, 0]}>
          <boxGeometry
            args={[
              GAME_VIEW_TOKENS.card.width + 0.09,
              GAME_VIEW_TOKENS.card.depth,
              GAME_VIEW_TOKENS.card.height + 0.09,
            ]}
          />
          <meshStandardMaterial color={GAME_VIEW_TOKENS.color.selected} />
        </mesh>
      ) : null}
    </group>
  );
}

function rowCardX(index: number, capacity: number): number {
  const step = GAME_VIEW_TOKENS.card.width + GAME_VIEW_TOKENS.card.gap;
  return (index - (capacity - 1) / 2) * step;
}

const ROW_Z: Readonly<Record<PlacementRow, number>> = Object.freeze({
  front: -1.76,
  middle: 0,
  back: 1.76,
});

function SeatBoard({
  seat,
  assignments,
  selectedCard,
  validRows,
  reducedMotion,
  onSelectCard,
  onSelectRow,
}: {
  readonly seat: SceneSeat;
  readonly assignments: Readonly<Partial<Record<CardCode, PlacementRow>>>;
  readonly selectedCard: CardCode | undefined;
  readonly validRows: readonly PlacementRow[];
  readonly reducedMotion: boolean;
  readonly onSelectCard: (card: CardCode) => void;
  readonly onSelectRow: (row: PlacementRow) => void;
}) {
  return (
    <group position={seat.layout.position} name={`seat-${seat.layout.seat}`}>
      {ROW_DEFINITIONS.map(({ row, capacity }) => {
        const cards = seat.board[row];
        const stagedCards = seat.layout.isLocal
          ? (Object.entries(assignments) as [CardCode, PlacementRow][])
              .filter(([, assignedRow]) => assignedRow === row)
              .map(([card]) => card)
          : [];
        const valid = seat.layout.isLocal && validRows.includes(row);
        return (
          <group key={row} position={[0, 0, ROW_Z[row]]} name={`${row}-row`}>
            {Array.from({ length: capacity }, (_, index) => (
              <mesh
                key={`${row}-slot-${index}`}
                position={[rowCardX(index, capacity), 0.012, 0]}
                name={`${row}-slot-${index + 1}`}
                {...(valid
                  ? {
                      onClick: (event: ThreeEvent<MouseEvent>) => {
                        event.stopPropagation();
                        onSelectRow(row);
                      },
                    }
                  : {})}
              >
                <boxGeometry
                  args={[
                    GAME_VIEW_TOKENS.card.width + 0.045,
                    0.018,
                    GAME_VIEW_TOKENS.card.height + 0.045,
                  ]}
                />
                <meshStandardMaterial
                  color={
                    valid
                      ? GAME_VIEW_TOKENS.color.valid
                      : GAME_VIEW_TOKENS.color.unavailable
                  }
                  transparent
                  opacity={valid ? 0.72 : 0.26}
                />
              </mesh>
            ))}
            {cards.map((card, index) => (
              <PlayingCard
                key={card}
                code={card}
                position={[rowCardX(index, capacity), 0.045, 0]}
                reducedMotion
                faceUp={!seat.faceDown}
              />
            ))}
            {stagedCards.map((card, stagedIndex) => (
              <PlayingCard
                key={`staged-${card}`}
                code={card}
                position={[
                  rowCardX(cards.length + stagedIndex, capacity),
                  0.05,
                  0,
                ]}
                selected={card === selectedCard}
                interactive
                reducedMotion={reducedMotion}
                onClick={() => onSelectCard(card)}
              />
            ))}
            {seat.faceDown && cards.length === 0 && seat.hiddenCardCount === 13
              ? Array.from({ length: capacity }, (_, index) => (
                  <PlayingCard
                    key={`hidden-${row}-${index}`}
                    code={"2c"}
                    position={[rowCardX(index, capacity), 0.045, 0]}
                    reducedMotion
                    faceUp={false}
                  />
                ))
              : null}
          </group>
        );
      })}
    </group>
  );
}

function AimCamera() {
  const camera = useThree(({ camera: value }) => value);
  useEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

export function GameTableScene({
  seats,
  pendingCards,
  assignments,
  selectedCard,
  validRows,
  reducedMotion,
  onSelectCard,
  onSelectRow,
}: GameTableSceneProps) {
  const localSeat = seats.find(({ layout }) => layout.isLocal);
  const localHandZ =
    (localSeat?.layout.position[2] ?? 3.6) +
    ROW_Z.back +
    GAME_VIEW_TOKENS.card.height +
    0.16;
  return (
    <>
      <AimCamera />
      <color attach="background" args={[GAME_VIEW_TOKENS.color.feltEdge]} />
      <ambientLight intensity={1.55} />
      <directionalLight
        position={[2, 9, 5]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <mesh receiveShadow position={[0, -0.08, 0]}>
        <cylinderGeometry args={[9.2, 9.35, 0.2, 64]} />
        <meshStandardMaterial
          color={GAME_VIEW_TOKENS.color.felt}
          roughness={0.9}
        />
      </mesh>
      {seats.map((seat) => (
        <SeatBoard
          key={seat.id}
          seat={seat}
          assignments={assignments}
          selectedCard={selectedCard}
          validRows={validRows}
          reducedMotion={reducedMotion}
          onSelectCard={onSelectCard}
          onSelectRow={onSelectRow}
        />
      ))}
      <group position={[0, 0.08, localHandZ]} name="local-hand">
        {pendingCards
          .filter((card) => assignments[card] === undefined)
          .map((card, index, unassignedCards) => (
            <PlayingCard
              key={card}
              code={card}
              position={[rowCardX(index, unassignedCards.length), 0, 0]}
              selected={card === selectedCard}
              interactive
              reducedMotion={reducedMotion}
              onClick={() => onSelectCard(card)}
            />
          ))}
      </group>
    </>
  );
}
