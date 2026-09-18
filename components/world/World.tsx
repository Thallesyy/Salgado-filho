"use client";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { journey } from "@/lib/journey";
import { FLOOR } from "@/lib/world";
import { AmbientTraffic, HeroAircraft, ParkedFleet } from "./Aircraft";
import Airfield from "./Airfield";
import City from "./City";
import CloudLayer from "./Clouds";
import Ground from "./Ground";
import Landside from "./Landside";
import Materiais from "./Materiais";
import Crowd, { airsideAgents, hallAgents, landsideAgents } from "./People";
import Terminal from "./Terminal";

function Dust() {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const p = journey.render;
    if (ref.current) ref.current.visible = p > 0.12 && p < 0.42;
  });
  return (
    <group ref={ref}>
      <Sparkles count={260} scale={[60, 12, 56]} position={[0, FLOOR + 6, -14]} size={2.2} speed={0.18} opacity={0.35} color="#ffe2b8" noise={0.6} />
    </group>
  );
}

export default function World() {
  const agents = useMemo(() => ({ land: landsideAgents(), hall: hallAgents(), air: airsideAgents() }), []);
  return (
    <group>
      <Materiais />
      <group name="w-ground">
        <Ground />
      </group>
      <group name="w-airfield">
        <Airfield />
      </group>
      <group name="w-landside">
        <Landside />
      </group>
      <group name="w-terminal">
        <Terminal />
      </group>
      <group name="w-crowd">
        <Crowd agents={agents.land} visibleIn={[[0, 0.16]]} />
        <Crowd agents={agents.hall} visibleIn={[[0.1, 0.3]]} />
        <Crowd agents={agents.air} visibleIn={[[0.24, 0.45]]} />
        <Dust />
      </group>
      <group name="w-hero">
        <HeroAircraft />
      </group>
      <group name="w-fleet">
        <ParkedFleet />
        <AmbientTraffic />
      </group>
      <group name="w-city">
        <City />
      </group>
      <group name="w-clouds">
        <CloudLayer />
      </group>
    </group>
  );
}
