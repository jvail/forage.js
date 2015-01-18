// 'use strict';

/*
  Forage field curing, harvest and storage losses.

  REFERENCES

  Buckmaster, D.R., Rotz, C.A., Muck, R.E. 1989. A comprehensive model of forage changes in the silo.
  Transactions of the ASAE 32(4):1143-1152.

  Klinner, W.E. 1976. Mechanical and chemical field treatment of grass for conservation.
  Paper 2, Joint Conference of the Institution of Agricultural Engineers and the British Grassland Society.

  McGechan, M.B. 1989. A review of losses arising during conservation of grass forage: part 1, field losses.
  Journal of Agricultural Engineering Research 44:1-21.

  McGechan, M.B. 1990. A review of losses arising during conservation of grass forage: part 2, storage losses.
  Journal of Agricultural Engineering Research 45:1-30.

  Pitt, R.E. 1986. Dry matter losses due to oxygen infiltration in silos.
  Journal of Agricultural Engineering Research 35:193-205.

  Rotz, C.A., Pitt, R.E., Muck, R.E., Allen, M.S. and Buckmaster, D.R. 1993.
  Direct-cut harvest and storage of alfalfa on the dairy farm. Transactions of the ASAE 36(3):621-628.

  Rotz, C.A. 1995. Loss models for forage harvest. Transactions of the ASAE 38(6):1621-1631.

  Rotz, C.A. and Chen, Y. 1985. Alfalfa drying model for the field environment. 
  Transactions of the ASAE 28(5):1686-1691.

  Rotz, C.A. 1985. Economics of chemically conditioned alfalfa on Michigan dairy farms. 
  Transactions of the ASAE 28(4):1024-1030.

  Rotz, C.A., Abrams, S.M. and Davis, R.J. 1987. Alfalfa drying, loss and quality as influenced by mechanical and 
  chemical conditioning. Transactions of the ASAE 30(3):630-635.

  Rotz, C. A., Corson, M.S., Chianese, D.S., Montes, F., Hafner, S.D., Bonifacio, H.F. and Coiner, C.U. 2014.
  The integrated farm system model: reference manual version 4.1. http://www.ars.usda.gov/News/docs.htm?docid=8519

  LICENSE
  
  Copyright 2014 Jan Vaillant   <jan.vaillant@zalf.de>
  Copyright 2014 Lisa Baldinger <lisa.baldinger@boku.ac.at>
  
  Distributed under the MIT License. See accompanying file LICENSE or copy at http://opensource.org/licenses/MIT
  
  Any publication for which this file or a derived work is used must include an a reference to the article:
  
  Baldinger, L., Vaillant, J., Zollitsch, W., Rinne, M. (2014) SOLID-DSS - Eine online-Anwendung zur verbesserten 
  Abstimmung von Grundfutterangebot und -bedarf auf biologisch wirtschaftenden Low Input Milchviehbetrieben.
  In: Wiesinger, K., Cais, K., Obermaier, S. (eds), Angewandte Forschung und Beratung für den ökologischen Landbau in 
  Bayern: Öko-Landbau-Tag 2014 am 9. April 2014 in Triesdorf; Tagungsband. LfL, Freising-Weihenstephan, pp. 19-22.
*/

var forage = forage || {};

forage.harvest = (function () {

  var exp = Math.exp
    , pow = Math.pow
    ;

  /* constants Rotz et. al. (2014) */
  var AR = 0          /* chemical application rate [g g-1 (DM)] */
    , WRR = 150       /* rain moisture absorbtion rate [g m-2 mm-1] */
    , WRD = -4        /* dew moisture absobtion rate [g m-2 h-1] */
    ;

  /*
    Rotz et. al. (2014) eq. 6.5

    M_e   [kg (H20) kg-1 (DM)]  equilibrium moisture content of mown forage in the night
    wind  [m s-1]               wind speed
    rh    [-]                   relative humidity
  */  

  function M_e(wind, rh) {

    return 0.4 + (3.6 / exp(0.2 * wind)) / exp(2.5 * (1 - rh));

  }

  /*
    Rotz et. al. (2014) eq. 6.1

    dr  [1 h-1]   drying rate constant
    si  [W m-2]   solar insolation
    db  [°C]      dry bulb temperature
    sm  [kg kg-1] soil moisture
    sd  [g m-2]   swath density
    day [0-1]     mowed or raked (1st day and last day = 1 otherwise 0)
  */

  function dr(si, db, sm, sd, day) {

    return (si * (1 + 9.3 * AR) + 5.42 * db) / (66.4 * sm + sd * (2.06 - 0.97 * day) * (1.55 + 21.9 * AR) + 3037);

  }

  /*
    Rotz et. al. (1987)

    dr_adj  [1 h-1] drying rate constant adjusted for cut no. and conditioning
    dr      [1 h-1] drying rate constant
    co      [bool]  w (true) or w/o conditioning    
    cn      [#]     cut no.
  */

  function dr_adj(dr, co, cn) {

    if (co)
      return dr;

    if (cn === 1)
      return dr * 0.56;
    else if (cn === 2)
      return dr * 0.73;
    else
      return dr;

  }


  /*
    Rotz et. al. (2014)

    Field curing. Assume length of morning&evening period is (day_len - 6) * 0.5

    M_c      [kg (H20) kg-1 (DM)] forage moisture content (after one hour)
    M_i      [kg (H20) kg-1 (DM)] initial forage moisture content
    dr_adj   [1 h-1]              drying rate constant adjusted for cut no. and conditioning
    h        [hour]               hours after sunrise
    day_len  [hour]               day length

  */

  function M_c(M_i, dr_adj, h, day_len) {

    var morning_len = (day_len - 6) * 0.5
      , diurnal_adj = 1
      ;

    /* strip decimals */
    h = h | 0;
    day_len = day_len | 0;

    /* diurnal adjustement factor */
    if (h <= morning_len)
      diurnal_adj = 0.80;
    else if (h <= morning_len + 3)
      diurnal_adj = 1.40;
    else if (h <= morning_len + 6)
      diurnal_adj = 1.26;
    else
      diurnal_adj = 0.70;

    return M_i / exp(dr_adj * diurnal_adj);

  };


  /*
    Rotz et. al. (2014)

    Field curing adjusted for rewetting during night (dew)

    M_f     [kg (H20) kg-1 (DM)]  forage moisture content in the morning
    M_i     [kg (H20) kg-1 (DM)]  initial forage moisture content
    sd      [g m-2]               swath density
    wind    [m s-1]               wind speed
    rh      [-]                   relative humidity
    day_len [hour]                day length
  */

  function M_f(M_i, sd, wind, rh, day_len) {

    return 4 + ((M_e(wind, rh) + (M_i - M_e(wind, rh)) * exp(WRD * (24 - day_len) / sd)) - 4) * exp(-WRR * (rn /sd));

  };

  /*
    Rotz et. al. (2014)

    Field curing adjusted for rain

    M_r     [kg (H20) kg-1 (DM)]  forage moisture content after rain
    M_i     [kg (H20) kg-1 (DM)]  initial forage moisture content
    sd      [g m-2]               swath density
    rn      [mm]                  rainfall
  */

  function M_r(M_i, sd, rn) {

    return 4 + (M_i - 4) * exp(WRR * (rn / sd));

  };

  /*
    Rotz and Chen (1985) eqs. 2,5, Rotz (1985) eqs. 4,6

    Field curing: calculate hourly moisture of mown forage.

    curing [kg (H20) kg-1 (FM)]  array
    M_i     [kg (H20) kg-1 (FM)]  inital forage moisture
    si      [W m-2]               solar insolation      
    day_len [hour]                day length
    rn      [mm]
    co      [bool]                w. (true) or w/o conditioning  
    cn      [#]                   cut no.
    wind    [m s-1]               wind speed
    rh      [-]                   relative humidity
    mowed   [bool]                      
    raked   [bool] 
  */

  var curing = function (M_i, si, day_len, rn, co, cn, wind, rh, mowed, raked) {

    var moisture = [M_i / (1 - M_i)]  /* [kg (H20) kg-1 (DM)] */
      , day = (mowed || raked) ? 1 : 0
      , drying_rate = dr_adj(dr(si, db, sm, sd, day), co, cn)
      ;

    /* strip decimals */
    day_len = day_len | 0;

    /* if not day of mowing adjust for dew & rain */
    if (!mowed)
      moisture[0] = M_f(M_r(M_i / (1 - M_i), sd, rn), sd, wind, rh, day_len);

    for (var h = 1; h <= day_len; h++)
      moisture[h] = M_c(moisture[h - 1], drying_rate, h, day_len);

    /* convert to fresh matter basis [kg (H20) kg-1 (FM)] */
    for (var i = 0, is = moisture.length; i < is; i++)
      moisture[i] = moisture[i] / (moisture[i] + 1);

    return moisture;   

  };

  /*
    Rotz (1995) eq. 3

    loss_rs [kg kg-1]             loss caused by respiration during curing
    m_o     [kg (H20) kg-1 (FM)]  initial moisture
    m_f     [kg (H20) kg-1 (FM)]  final moisture
    T_avg   [°C]
    t_fc    [h]                   field curing time
  */

  var loss_rs = function (m_o, m_f, T_avg, t_fc) {

    return 0.000047 * T_avg * t_fc * (pow(m_o, 3.6) - pow(m_f, 3.6)) / (m_o - m_f);
  
  };

  /*
    Rotz et. al. (2014), Rotz (1995)

    loss_r  [kg kg-1]             leaching loss caused by rain
    M_i     [kg (H20) kg-1 (FM)]  moisture
    co      [bool]                w (true) or w/o conditioning                 
    ndf     [kg kg-1]             NDF
    rn      [mm]                  rainfall
    sd      [g m-2]               swath density
  */

  var loss_r = function (M_i, co, ndf, rn, sd) {

    /* conditioning factor */
    var f_c = co ? 1 : 0.8;

    return (f_c * 0.0061 * (1 - ndf) * (0.9 - M_i) * rn) / (sd / 1000);
  
  };

  /*
    Rotz et. al. (2014), Rotz (1995) eq. 8

    loss_m  [kg kg-1] shatter losses caused by mowing and conditioning 
    s       [#]       crop stage factor
    co      [bool]    w (true) or w/o conditioning 
    F_l     [kg kg-1] fraction of forage dry matter that is legume leaf
  */

  var loss_m = function (s, co, F_l) {

    /* mower factor */
    var f_m = co ? 1 : 0.5;

    return f_m * 0.006 * (1 + 2 * F_l) * s;
  
  };

  /*
    Rotz et. al. (2014), Rotz (1995) eq. 10

    loss_t  [kg kg-1]             shatter losses caused by tedding 
    M_i     [kg (H20) kg-1 (FM)]  moisture
    F_l     [kg kg-1]             fraction of forage dry matter that is legume leaf
  */

  var loss_t = function (M_i, F_l) {

    return 0.044 * (1 + 6 * F_l) * (1 - pow(M_i, 1.5));
  
  };

  /*
    Rotz et. al. (2014), Rotz (1995) eq. 13

    loss_rk [kg kg-1]             shatter losses caused by raking 
    M_i     [kg (H20) kg-1 (FM)]  moisture
    F_l     [kg kg-1]             fraction of forage dry matter that is legume leaf
    sd      [g m-2]               swath density
  */

  var loss_rk = function (M_i, F_l, sd) {

    return (0.02 * (1 + 2 * F_l) * (1 - pow(M_i, 1.5))) / (sd / 1000);
  
  };

  return {
      curing: curing
    , loss_rs : loss_rs
    , loss_r : loss_r
    , loss_m : loss_m
    , loss_t : loss_t
    , loss_rk : loss_rk
  };

}()); 


forage.storage = (function () {

  var exp = Math.exp
    , pow = Math.pow
    ;

  /*
    Klinner (1976)

    Eq. parameters derived from McGechan (1990) fig. 1

    loss_hay  [kg kg-1]             storage losses
    M_i       [kg (H20) kg-1 (DM)]  moisture
  */

  var loss_hay = function (M_i) {

    return 1.2662 * exp(0.0373 * M_i * 100) / 100;

  };

  /*
    Buckmaster et. al. 1989, eq. 19

    loss_fm [kg (DM) kg-1 (DM)]  fermentation losses 
    dmc     [kg (DM) kg-1 (FM)]  dry matter fraction 
  */

  var loss_fm = function (dmc) {

    return 0.00864 - 0.0193 * (dmc- 0.15);

  };

  /*
    Rotz et. al. 1993, eq. 8

    Assume max. storage time of 365 days.

    loss_e  [kg (DM) kg-1 (DM) d-1]   losses due to effluent production (daily average)
    dmc     [kg (DM) kg-1 (FM)]       dry matter fraction 
    dm      [t]                       dry matter in silo 
    time    [day]                     days since silo sealing 
  */

  var loss_e = function (dmc, dm, time) {

    var loss = 0
      /* max. possible loss [l t-1] */
      , volmax = (dmc >= 0.29) ? 0 : (767 - 5340 * dmc + 9360 * pow(dmc, 2))
      /* fraction of effluent obtained in given storage time */
      , foft_3 = 0.0148 * pow(3, 2)
      , foft_79 = 0.133 + 0.017 * (79 - 3) - 0.000107 * (pow(79, 2) - 9) + 0.241 * (1 - exp(-0.298 * (79 - 3)))
      ;

    if (time <= 3)
      loss = 0.1035 * volmax * foft_3 / dm * (1 / 3);
    else if (time <= 79)
      loss = ((0.1035 * volmax * foft_79 / dm) - (0.1035 * volmax * foft_3 / dm)) * (1 / 79);

    return loss;

  };

  return {
      loss_hay: loss_hay
    , loss_fm: loss_fm
    , loss_e : loss_e
  };


}()); 
