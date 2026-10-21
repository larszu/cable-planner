// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// German translation. `Record<Key, Msg>` makes a missing key a type error; the area files
// catch extra or mistyped keys (`satisfies Translation<typeof en>`).
import common from './de/common';
import bridge from './de/bridge';



import tools from './de/tools';
import clock from './de/clock';
import audio from './de/audio';
import ui from './de/ui';
import record from './de/record';

import bridgeui from './de/bridgeui';
import chain from './de/chain';
import color from './de/color';
import genlock from './de/genlock';
import lut from './de/lut';
import main from './de/main';
import match from './de/match';
import menu from './de/menu';
import output from './de/output';
import panel from './de/panel';
import pattern from './de/pattern';
import render from './de/render';
import scene from './de/scene';
import scope from './de/scope';
import shading from './de/shading';
import source from './de/source';
import testmedia from './de/testmedia';
import theme from './de/theme';
import native from './de/native';
import sysprofile from './de/sysprofile';
import opple from './de/opple';
import led from './de/led';
import calib from './de/calib';
import feedback from './de/feedback';
import help from './de/help';
import compare from './de/compare';
import wallcheck from './de/wallcheck';
import sim from './de/sim';
import enc from './de/enc';
import lens from './de/lens';
import type { Key } from './en';
import type { Msg } from './types';

export const de: Record<Key, Msg> = {
  ...common,
  ...bridge,
  ...tools,
  ...clock,
  ...audio,
  ...ui,
  ...record,
  ...bridgeui,
  ...chain,
  ...color,
  ...genlock,
  ...lut,
  ...main,
  ...match,
  ...menu,
  ...output,
  ...panel,
  ...pattern,
  ...render,
  ...scene,
  ...scope,
  ...shading,
  ...source,
  ...testmedia,
  ...theme,
  ...native,
  ...sysprofile,
  ...opple,
  ...led,
  ...calib,
  ...feedback,
  ...help,
  ...compare,
  ...wallcheck,
  ...sim,
  ...enc,
  ...lens,
};
