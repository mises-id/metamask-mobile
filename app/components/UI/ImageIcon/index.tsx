import { Image } from 'react-native';
import React from 'react';
import images from 'images/image-icons';

interface ImageIconPropTypes {
  image:
    | 'PALM'
    | 'MATIC'
    | 'OPTIMISM'
    | 'ONE'
    | 'FTM'
    | 'ETHEREUM'
    | 'BNB'
    | 'AETH'
    | 'AVAX'
    | 'MISES';
  style: any;
}

const ImageIcon = (props: ImageIconPropTypes) => {
  const { image, style } = props;

  if (!image) return null;
  const source = images[image];
  if (!source) {
    return null;
  }

  return <Image source={source} style={style} />;
};

export default ImageIcon;
