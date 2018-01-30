import React from 'react'
import styled, { css } from 'styled-components'
import { Link } from 'react-router-dom'

const HeadingBar = styled.div`
  background-color: #F8F8F8;
  border-top: 1px solid #DADADA;
  color: #888;
  font-weight: 500;
  padding: 8px 10px 7px;

  ${props => (props.borderBottom) && css`
    border-bottom: 1px solid #DADADA;
  `}
`

export default HeadingBar
